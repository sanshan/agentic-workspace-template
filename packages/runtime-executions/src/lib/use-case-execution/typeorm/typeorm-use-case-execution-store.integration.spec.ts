import {
    DefaultExecutionIdFactory,
    type ExecutionLeaseOwnerId,
} from '@event-driven-platform/execution';
import type { Intent } from '@event-driven-platform/intent';
import { DataSource } from 'typeorm';

import {
    USE_CASE_EXECUTION_TYPEORM_ENTITIES,
    USE_CASE_EXECUTION_TYPEORM_MIGRATIONS,
    createUseCaseExecutionStore,
} from '../../../use-case-execution/typeorm.js';

const [UseCaseExecutionEntity] = USE_CASE_EXECUTION_TYPEORM_ENTITIES;
const [UseCaseExecutionMigration] = USE_CASE_EXECUTION_TYPEORM_MIGRATIONS;

const ownerA = 'use-case-owner-a' as ExecutionLeaseOwnerId;
const ownerB = 'use-case-owner-b' as ExecutionLeaseOwnerId;

function createIntent(id: string, parentId?: string): Intent {
    const base = {
        id,
        key: `documents:register:v1:${id}`,
    };

    if (!parentId) {
        return base;
    }

    return {
        ...base,
        parent: { id: parentId },
    };
}

function createDataSource(): DataSource {
    return new DataSource({
        type: 'postgres',
        host: process.env['DB_HOST'] ?? '127.0.0.1',
        port: Number(process.env['DB_PORT'] ?? '5432'),
        username: process.env['DB_USERNAME'] ?? 'postgres',
        password: process.env['DB_PASSWORD'] ?? 'postgres',
        database: process.env['DB_NAME'] ?? 'agentic-workspace',
        entities: [...USE_CASE_EXECUTION_TYPEORM_ENTITIES],
        synchronize: false,
    });
}

describe('TypeOrmUseCaseExecutionStore', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
        dataSource = await createDataSource().initialize();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.query('DROP TABLE IF EXISTS "use_case_execution"');
        await new UseCaseExecutionMigration().up(queryRunner);
        await queryRunner.release();
    });

    afterEach(async () => {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await new UseCaseExecutionMigration().down(queryRunner);
        await queryRunner.release();
        await dataSource.destroy();
    });

    it('serializes concurrent claims, advances reclaim fencing, and rejects the stale owner', async () => {
        const store = createUseCaseExecutionStore(dataSource);
        const intent = createIntent('use-case-intent-1', 'parent-intent-1');
        const executionId = new DefaultExecutionIdFactory().create(intent.id);
        const firstRequest = {
            executionId,
            intent,
            correlationId: 'correlation-1',
            leaseOwnerId: ownerA,
            leaseDurationMs: 30_000,
            requestedAt: '2026-08-24T10:00:00.000Z',
        };

        const claims = await Promise.all(
            Array.from({ length: 6 }, () => store.claim(firstRequest)),
        );

        expect(claims.filter((claim) => claim.type === 'claimed')).toHaveLength(1);
        expect(claims.filter((claim) => claim.type === 'already-in-progress')).toHaveLength(5);

        const firstClaim = claims.find((claim) => claim.type === 'claimed');
        if (!firstClaim || firstClaim.type !== 'claimed') {
            throw new Error('Expected one winning UseCase execution claim.');
        }

        expect(firstClaim.lease.version).toBe(1);
        expect(firstClaim.lease.ownerId).toBe(ownerA);

        const reclaimed = await store.claim({
            ...firstRequest,
            correlationId: 'correlation-2',
            leaseOwnerId: ownerB,
            requestedAt: '2026-08-24T10:00:31.000Z',
        });

        expect(reclaimed.type).toBe('claimed');
        if (reclaimed.type !== 'claimed') {
            throw new Error('Expected expired UseCase execution lease to be reclaimed.');
        }

        expect(reclaimed.lease.version).toBe(2);
        expect(reclaimed.lease.ownerId).toBe(ownerB);

        const staleCompletion = await store.complete({
            executionId,
            lease: firstClaim.lease,
            result: { documentId: 'document-1' },
            completedAt: '2026-08-24T10:00:32.000Z',
        });
        const staleRelease = await store.release({
            executionId,
            lease: firstClaim.lease,
            releasedAt: '2026-08-24T10:00:32.000Z',
        });

        expect(staleCompletion.type).toBe('lease-conflict');
        expect(staleRelease.type).toBe('lease-conflict');

        const persisted = await dataSource.getRepository(UseCaseExecutionEntity).findOneByOrFail({
            executionId,
        });
        expect(persisted.status).toBe('in-progress');
        expect(persisted.leaseOwnerId).toBe(ownerB);
        expect(persisted.leaseVersion).toBe(2);
        expect(persisted.parentIntentId).toBe('parent-intent-1');
        expect(persisted.correlationId).toBe('correlation-2');
    });

    it('allows the current owner to complete after expiry until a reclaim occurs and durably replays the result', async () => {
        const store = createUseCaseExecutionStore(dataSource);
        const intent = createIntent('use-case-intent-complete');
        const executionId = new DefaultExecutionIdFactory().create(intent.id);
        const claim = await store.claim<{ documentId: string }>({
            executionId,
            intent,
            correlationId: 'correlation-complete',
            leaseOwnerId: ownerA,
            leaseDurationMs: 1_000,
            requestedAt: '2026-08-24T11:00:00.000Z',
        });

        if (claim.type !== 'claimed') {
            throw new Error('Expected UseCase execution to be claimed.');
        }

        const result = { documentId: 'document-1' };
        const completion = await store.complete({
            executionId,
            lease: claim.lease,
            result,
            completedAt: '2026-08-24T11:00:02.000Z',
        });

        expect(completion.type).toBe('completed');

        const replay = await store.claim<typeof result>({
            executionId,
            intent,
            correlationId: 'correlation-replay',
            leaseOwnerId: ownerB,
            leaseDurationMs: 30_000,
            requestedAt: '2026-08-24T11:01:00.000Z',
        });

        expect(replay).toEqual({
            type: 'completed',
            result,
            completedAt: '2026-08-24T11:00:02.000Z',
        });

        const persisted = await dataSource.getRepository(UseCaseExecutionEntity).findOneByOrFail({
            executionId,
        });
        expect(persisted.status).toBe('completed');
        expect(persisted.leaseOwnerId).toBeNull();
        expect(persisted.leaseAcquiredAt).toBeNull();
        expect(persisted.leaseExpiresAt).toBeNull();
        expect(persisted.result).toEqual(result);
    });

    it('makes a released invocation immediately claimable again without creating history', async () => {
        const store = createUseCaseExecutionStore(dataSource);
        const intent = createIntent('use-case-intent-release');
        const executionId = new DefaultExecutionIdFactory().create(intent.id);
        const firstClaim = await store.claim({
            executionId,
            intent,
            correlationId: 'correlation-release-1',
            leaseOwnerId: ownerA,
            leaseDurationMs: 30_000,
            requestedAt: '2026-08-24T12:00:00.000Z',
        });

        if (firstClaim.type !== 'claimed') {
            throw new Error('Expected UseCase execution to be claimed.');
        }

        const release = await store.release({
            executionId,
            lease: firstClaim.lease,
            releasedAt: '2026-08-24T12:00:01.000Z',
        });
        expect(release.type).toBe('released');

        const secondClaim = await store.claim({
            executionId,
            intent,
            correlationId: 'correlation-release-2',
            leaseOwnerId: ownerB,
            leaseDurationMs: 30_000,
            requestedAt: '2026-08-24T12:00:02.000Z',
        });

        expect(secondClaim.type).toBe('claimed');
        if (secondClaim.type !== 'claimed') {
            throw new Error('Expected released UseCase execution to be reclaimed.');
        }
        expect(secondClaim.lease.version).toBe(2);
        expect(secondClaim.lease.ownerId).toBe(ownerB);

        const persistedRows = await dataSource.getRepository(UseCaseExecutionEntity).find({
            where: { executionId },
        });
        expect(persistedRows).toHaveLength(1);
        expect(persistedRows[0]?.status).toBe('in-progress');
        expect(persistedRows[0]?.releasedAt).toBeNull();
    });

    it('rejects a conflicting authoritative Intent for an existing execution identity', async () => {
        const store = createUseCaseExecutionStore(dataSource);
        const originalIntent = createIntent('use-case-intent-original');
        const executionId = new DefaultExecutionIdFactory().create(originalIntent.id);
        const firstClaim = await store.claim({
            executionId,
            intent: originalIntent,
            correlationId: 'correlation-original',
            leaseOwnerId: ownerA,
            leaseDurationMs: 30_000,
            requestedAt: '2026-08-24T13:00:00.000Z',
        });
        expect(firstClaim.type).toBe('claimed');

        const conflict = await store.claim({
            executionId,
            intent: createIntent('use-case-intent-conflicting'),
            correlationId: 'correlation-conflict',
            leaseOwnerId: ownerB,
            leaseDurationMs: 30_000,
            requestedAt: '2026-08-24T13:00:01.000Z',
        });

        expect(conflict).toEqual({
            type: 'intent-conflict',
            existingIntentId: originalIntent.id,
        });
    });

    it('enforces impossible lease/status combinations in the database schema', async () => {
        const intent = createIntent('use-case-intent-invalid-state');
        const executionId = new DefaultExecutionIdFactory().create(intent.id);

        await expect(
            dataSource.query(
                `
                    INSERT INTO "use_case_execution" (
                        "execution_id", "intent_id", "parent_intent_id", "intent",
                        "correlation_id", "status", "lease_owner_id", "lease_version",
                        "lease_acquired_at", "lease_expires_at", "result", "created_at",
                        "released_at", "completed_at"
                    ) VALUES (
                        $1, $2, NULL, $3, 'correlation-invalid', 'released',
                        $4, 1, $5, $6, NULL, $5, $5, NULL
                    )
                `,
                [
                    executionId,
                    intent.id,
                    intent,
                    ownerA,
                    new Date('2026-08-24T14:00:00.000Z'),
                    new Date('2026-08-24T14:00:30.000Z'),
                ],
            ),
        ).rejects.toThrow();
    });
});

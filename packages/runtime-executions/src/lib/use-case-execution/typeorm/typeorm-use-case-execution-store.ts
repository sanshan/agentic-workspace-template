import { isDeepStrictEqual } from 'node:util';

import type {
    ExecutionId,
    ExecutionLease,
    ExecutionLeaseReference,
    ExecutionLeaseVersion,
} from '@event-driven-platform/execution';
import type { Intent } from '@event-driven-platform/intent';
import type {
    ClaimUseCaseExecutionRequest,
    ClaimUseCaseExecutionResult,
    CompleteUseCaseExecutionRequest,
    CompleteUseCaseExecutionResult,
    ReleaseUseCaseExecutionRequest,
    ReleaseUseCaseExecutionResult,
    UseCaseExecutionStore,
} from '@event-driven-platform/use-case-execution-store';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import { UseCaseExecutionEntity } from './use-case-execution.entity.js';

function normalizeJson(value: unknown): unknown {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
        throw new TypeError('UseCase execution value must be JSON-serializable.');
    }

    const parsed: unknown = JSON.parse(serialized);

    return parsed;
}

function sameIntent(persisted: Intent, requested: Intent): boolean {
    return isDeepStrictEqual(persisted, normalizeJson(requested));
}

export class TypeOrmUseCaseExecutionStore implements UseCaseExecutionStore {
    private readonly repository: Repository<UseCaseExecutionEntity>;

    public constructor(dataSource: DataSource) {
        this.repository = dataSource.getRepository(UseCaseExecutionEntity);
    }

    public claim<TResult>(
        request: ClaimUseCaseExecutionRequest,
    ): Promise<ClaimUseCaseExecutionResult<TResult>> {
        return this.repository.manager.transaction(async (manager) => {
            const requestedAt = new Date(request.requestedAt);
            const firstLeaseVersion = 1 as ExecutionLeaseVersion;
            const firstLease = this.createLease(
                request.leaseOwnerId,
                firstLeaseVersion,
                requestedAt,
                request.leaseDurationMs,
            );
            const insertedRows: unknown = await manager.query(
                `
                    INSERT INTO "use_case_execution" (
                        "execution_id",
                        "intent_id",
                        "parent_intent_id",
                        "intent",
                        "correlation_id",
                        "status",
                        "lease_owner_id",
                        "lease_version",
                        "lease_acquired_at",
                        "lease_expires_at",
                        "result",
                        "created_at",
                        "released_at",
                        "completed_at"
                    ) VALUES (
                        $1, $2, $3, $4, $5, 'in-progress',
                        $6, $7, $8, $9, NULL, $10, NULL, NULL
                    )
                    ON CONFLICT DO NOTHING
                    RETURNING "execution_id"
                `,
                [
                    request.executionId,
                    request.intent.id,
                    request.intent.parent?.id ?? null,
                    request.intent,
                    request.correlationId,
                    firstLease.ownerId,
                    firstLease.version,
                    new Date(firstLease.acquiredAt),
                    new Date(firstLease.expiresAt),
                    requestedAt,
                ],
            );

            if (Array.isArray(insertedRows) && insertedRows.length > 0) {
                return {
                    type: 'claimed',
                    lease: firstLease,
                };
            }

            const execution = await manager.getRepository(UseCaseExecutionEntity).findOne({
                where: { executionId: request.executionId },
                lock: { mode: 'pessimistic_write' },
            });

            if (!execution) {
                throw new Error(
                    `Intent ${request.intent.id} is already associated with another UseCase execution.`,
                );
            }

            if (execution.intentId !== request.intent.id || !sameIntent(execution.intent, request.intent)) {
                return {
                    type: 'intent-conflict',
                    existingIntentId: execution.intentId,
                };
            }

            if (execution.status === 'completed') {
                if (!execution.completedAt) {
                    throw new Error(
                        `Completed UseCase execution ${execution.executionId} has no completion timestamp.`,
                    );
                }

                return {
                    type: 'completed',
                    result: execution.result as TResult,
                    completedAt: execution.completedAt.toISOString(),
                };
            }

            if (execution.status === 'in-progress') {
                const lease = this.getActiveLease(execution);

                if (new Date(lease.expiresAt).getTime() > requestedAt.getTime()) {
                    return {
                        type: 'already-in-progress',
                        lease,
                    };
                }
            }

            const nextLeaseVersion = (Number(execution.leaseVersion) + 1) as ExecutionLeaseVersion;
            const nextLease = this.createLease(
                request.leaseOwnerId,
                nextLeaseVersion,
                requestedAt,
                request.leaseDurationMs,
            );

            execution.correlationId = request.correlationId;
            execution.status = 'in-progress';
            execution.leaseOwnerId = nextLease.ownerId;
            execution.leaseVersion = nextLease.version;
            execution.leaseAcquiredAt = new Date(nextLease.acquiredAt);
            execution.leaseExpiresAt = new Date(nextLease.expiresAt);
            execution.result = null;
            execution.releasedAt = null;
            execution.completedAt = null;

            await manager.getRepository(UseCaseExecutionEntity).save(execution);

            return {
                type: 'claimed',
                lease: nextLease,
            };
        });
    }

    public complete<TResult>(
        request: CompleteUseCaseExecutionRequest<TResult>,
    ): Promise<CompleteUseCaseExecutionResult> {
        return this.repository.manager.transaction(async (manager) => {
            const execution = await this.lockExecution(manager, request.executionId);

            if (!execution) {
                return { type: 'not-found' };
            }

            if (execution.status !== 'in-progress') {
                return { type: 'not-in-progress' };
            }

            if (!this.isCurrentLease(execution, request.lease)) {
                return { type: 'lease-conflict' };
            }

            const completedAt = new Date(request.completedAt);
            execution.status = 'completed';
            execution.leaseOwnerId = null;
            execution.leaseAcquiredAt = null;
            execution.leaseExpiresAt = null;
            execution.result = normalizeJson(request.result);
            execution.releasedAt = null;
            execution.completedAt = completedAt;

            await manager.getRepository(UseCaseExecutionEntity).save(execution);

            return {
                type: 'completed',
                completedAt: completedAt.toISOString(),
            };
        });
    }

    public release(
        request: ReleaseUseCaseExecutionRequest,
    ): Promise<ReleaseUseCaseExecutionResult> {
        return this.repository.manager.transaction(async (manager) => {
            const execution = await this.lockExecution(manager, request.executionId);

            if (!execution) {
                return { type: 'not-found' };
            }

            if (execution.status !== 'in-progress') {
                return { type: 'not-in-progress' };
            }

            if (!this.isCurrentLease(execution, request.lease)) {
                return { type: 'lease-conflict' };
            }

            const releasedAt = new Date(request.releasedAt);
            execution.status = 'released';
            execution.leaseOwnerId = null;
            execution.leaseAcquiredAt = null;
            execution.leaseExpiresAt = null;
            execution.result = null;
            execution.releasedAt = releasedAt;
            execution.completedAt = null;

            await manager.getRepository(UseCaseExecutionEntity).save(execution);

            return {
                type: 'released',
                releasedAt: releasedAt.toISOString(),
            };
        });
    }

    private createLease(
        ownerId: ExecutionLease['ownerId'],
        version: ExecutionLeaseVersion,
        acquiredAt: Date,
        leaseDurationMs: number,
    ): ExecutionLease {
        return {
            ownerId,
            version,
            acquiredAt: acquiredAt.toISOString(),
            expiresAt: new Date(acquiredAt.getTime() + leaseDurationMs).toISOString(),
        };
    }

    private getActiveLease(execution: UseCaseExecutionEntity): ExecutionLease {
        if (!execution.leaseOwnerId || !execution.leaseAcquiredAt || !execution.leaseExpiresAt) {
            throw new Error(`UseCase execution ${execution.executionId} has incomplete lease state.`);
        }

        return {
            ownerId: execution.leaseOwnerId,
            version: execution.leaseVersion,
            acquiredAt: execution.leaseAcquiredAt.toISOString(),
            expiresAt: execution.leaseExpiresAt.toISOString(),
        };
    }

    private async lockExecution(
        manager: EntityManager,
        executionId: ExecutionId,
    ): Promise<UseCaseExecutionEntity | null> {
        return manager.getRepository(UseCaseExecutionEntity).findOne({
            where: { executionId },
            lock: { mode: 'pessimistic_write' },
        });
    }

    private isCurrentLease(
        execution: UseCaseExecutionEntity,
        lease: ExecutionLeaseReference,
    ): boolean {
        return execution.leaseOwnerId === lease.ownerId && execution.leaseVersion === lease.version;
    }
}

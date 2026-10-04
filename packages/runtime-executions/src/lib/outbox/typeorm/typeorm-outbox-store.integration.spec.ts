import { ExecutionTransactionOutcomes } from '@event-driven-platform/execution-transaction';
import type { AnyOutboxRecord } from '@event-driven-platform/outbox';
import { DataSource } from 'typeorm';

import {
    OUTBOX_TYPEORM_ENTITIES,
    OUTBOX_TYPEORM_MIGRATIONS,
    createOutboxStore,
} from '../../../outbox/typeorm.js';
import {
    createTransactionAwareDataSource,
    TypeOrmExecutionTransaction,
    TypeOrmTransactionContext,
} from '../../../typeorm.js';

const [OutboxEntity] = OUTBOX_TYPEORM_ENTITIES;
const [OutboxMigration] = OUTBOX_TYPEORM_MIGRATIONS;

function createOutboxRecord(
    id: string,
    intentId: string,
    occurredAt: string,
): AnyOutboxRecord {
    const eventId = id as AnyOutboxRecord['id'];

    return {
        id: eventId,
        envelope: {
            eventId,
            eventName: 'documents.registration-finished',
            schemaVersion: 1,
            occurredAt,
            intentId,
            correlationId: `correlation-${intentId}`,
            operationName: 'documents.finish-registration',
            tenant: {
                type: 'business',
                id: 'tenant-1' as AnyOutboxRecord['envelope']['tenant']['id'],
            },
            actor: {
                type: 'user',
                id: 'user-1',
                origin: {
                    ipAddress: null,
                    countryCode: null,
                    region: null,
                    city: null,
                    latitude: null,
                    longitude: null,
                    timezone: null,
                    environment: null,
                    host: null,
                    instance: null,
                },
            },
            subject: {
                type: 'user',
                id: 'user-1',
            },
            aggregate: {
                type: 'document',
                id: 'document-1' as AnyOutboxRecord['envelope']['aggregate']['id'],
            },
            payload: {
                documentId: 'document-1',
            },
        },
        createdAt: occurredAt,
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
        entities: [...OUTBOX_TYPEORM_ENTITIES],
        synchronize: false,
    });
}

describe('TypeOrmOutboxStore', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
        dataSource = await createDataSource().initialize();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.query('DROP TABLE IF EXISTS "outbox"');
        await new OutboxMigration().up(queryRunner);
        await queryRunner.release();
    });

    afterEach(async () => {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await new OutboxMigration().down(queryRunner);
        await queryRunner.release();
        await dataSource.destroy();
    });

    it('persists the CDC projection and joins the shared execution transaction', async () => {
        const transactionContext = new TypeOrmTransactionContext();
        const transactionAwareDataSource = createTransactionAwareDataSource(
            dataSource,
            transactionContext,
        );
        const store = createOutboxStore(transactionAwareDataSource);
        const transaction = new TypeOrmExecutionTransaction(dataSource, transactionContext);
        const persistedRecord = createOutboxRecord(
            '00000000-0000-4000-8000-000000000010',
            'intent-persisted',
            '2026-08-24T08:00:00.000Z',
        );

        await store.append([persistedRecord]);

        const persisted = await dataSource.getRepository(OutboxEntity).findOneByOrFail({
            id: persistedRecord.id,
        });

        expect(persisted.eventName).toBe(persistedRecord.envelope.eventName);
        expect(persisted.schemaVersion).toBe(persistedRecord.envelope.schemaVersion);
        expect(persisted.occurredAt.toISOString()).toBe(persistedRecord.envelope.occurredAt);
        expect(persisted.intentId).toBe(persistedRecord.envelope.intentId);
        expect(persisted.correlationId).toBe(persistedRecord.envelope.correlationId);
        expect(persisted.operationName).toBe(persistedRecord.envelope.operationName);
        expect(persisted.tenantType).toBe(persistedRecord.envelope.tenant.type);
        expect(persisted.tenantId).toBe(persistedRecord.envelope.tenant.id);
        expect(persisted.aggregateType).toBe(persistedRecord.envelope.aggregate.type);
        expect(persisted.aggregateId).toBe(persistedRecord.envelope.aggregate.id);
        expect(persisted.actorType).toBe(persistedRecord.envelope.actor.type);
        expect(persisted.actorId).toBe(persistedRecord.envelope.actor.id);
        expect(persisted.envelope).toEqual(persistedRecord.envelope);
        expect(persisted.createdAt.toISOString()).toBe(persistedRecord.createdAt);

        const rolledBackRecord = createOutboxRecord(
            '00000000-0000-4000-8000-000000000011',
            'intent-rolled-back',
            '2026-08-24T08:01:00.000Z',
        );

        await transaction.execute(async () => {
            await store.append([rolledBackRecord]);

            return ExecutionTransactionOutcomes.rollback(undefined);
        });

        await expect(
            dataSource.getRepository(OutboxEntity).findOneBy({ id: rolledBackRecord.id }),
        ).resolves.toBeNull();
    });
});

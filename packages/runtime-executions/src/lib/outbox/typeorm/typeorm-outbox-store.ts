import type { AnyOutboxRecord } from '@event-driven-platform/outbox';
import type { OutboxStore } from '@event-driven-platform/outbox-store';
import type { DataSource, Repository } from 'typeorm';

import { OutboxEntity } from './outbox.entity.js';

const OUTBOX_COLUMN_COUNT = 15;

export class TypeOrmOutboxStore implements OutboxStore {
    private readonly repository: Repository<OutboxEntity>;

    public constructor(dataSource: DataSource) {
        this.repository = dataSource.getRepository(OutboxEntity);
    }

    public async append(records: readonly AnyOutboxRecord[]): Promise<void> {
        if (records.length === 0) {
            return;
        }

        const parameters: Array<string | number> = [];
        const values = records.map((record, index) => {
            const envelope = JSON.stringify(record.envelope);

            if (envelope === undefined) {
                throw new Error(`Outbox record ${record.id} envelope could not be serialized.`);
            }

            parameters.push(
                record.id,
                record.envelope.eventName,
                record.envelope.schemaVersion,
                record.envelope.occurredAt,
                record.envelope.intentId,
                record.envelope.correlationId,
                record.envelope.operationName,
                record.envelope.tenant.type,
                record.envelope.tenant.id,
                record.envelope.aggregate.type,
                record.envelope.aggregate.id,
                record.envelope.actor.type,
                record.envelope.actor.id,
                envelope,
                record.createdAt,
            );

            const offset = index * OUTBOX_COLUMN_COUNT;

            return `(
                $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4},
                $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8},
                $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12},
                $${offset + 13}, $${offset + 14}::jsonb, $${offset + 15}
            )`;
        });

        await this.repository.query(
            `
                INSERT INTO "outbox" (
                    "id",
                    "event_name",
                    "schema_version",
                    "occurred_at",
                    "intent_id",
                    "correlation_id",
                    "operation_name",
                    "tenant_type",
                    "tenant_id",
                    "aggregate_type",
                    "aggregate_id",
                    "actor_type",
                    "actor_id",
                    "envelope",
                    "created_at"
                ) VALUES ${values.join(', ')}
            `,
            parameters,
        );
    }
}

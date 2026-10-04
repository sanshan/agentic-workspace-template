import type { AnyOutboxRecord } from '@event-driven-platform/outbox';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('outbox')
@Index('idx_outbox_intent_id', ['intentId'])
@Index('idx_outbox_correlation_id', ['correlationId'])
@Index('idx_outbox_event_occurred_at', ['eventName', 'occurredAt'])
@Index('idx_outbox_operation_occurred_at', ['operationName', 'occurredAt'])
@Index('idx_outbox_tenant_occurred_at', ['tenantType', 'tenantId', 'occurredAt'])
@Index('idx_outbox_aggregate_occurred_at', ['aggregateType', 'aggregateId', 'occurredAt'])
export class OutboxEntity {
    @PrimaryColumn({ type: 'uuid' })
    public id!: AnyOutboxRecord['id'];

    @Column({ name: 'event_name', type: 'varchar', nullable: false })
    public eventName!: AnyOutboxRecord['envelope']['eventName'];

    @Column({ name: 'schema_version', type: 'integer', nullable: false })
    public schemaVersion!: AnyOutboxRecord['envelope']['schemaVersion'];

    @Column({ name: 'occurred_at', type: 'timestamptz', nullable: false })
    public occurredAt!: Date;

    @Column({ name: 'intent_id', type: 'varchar', nullable: false })
    public intentId!: AnyOutboxRecord['envelope']['intentId'];

    @Column({ name: 'correlation_id', type: 'varchar', nullable: false })
    public correlationId!: AnyOutboxRecord['envelope']['correlationId'];

    @Column({ name: 'operation_name', type: 'varchar', nullable: false })
    public operationName!: AnyOutboxRecord['envelope']['operationName'];

    @Column({ name: 'tenant_type', type: 'varchar', nullable: false })
    public tenantType!: AnyOutboxRecord['envelope']['tenant']['type'];

    @Column({ name: 'tenant_id', type: 'varchar', nullable: false })
    public tenantId!: AnyOutboxRecord['envelope']['tenant']['id'];

    @Column({ name: 'aggregate_type', type: 'varchar', nullable: false })
    public aggregateType!: AnyOutboxRecord['envelope']['aggregate']['type'];

    @Column({ name: 'aggregate_id', type: 'varchar', nullable: false })
    public aggregateId!: AnyOutboxRecord['envelope']['aggregate']['id'];

    @Column({ name: 'actor_type', type: 'varchar', nullable: false })
    public actorType!: AnyOutboxRecord['envelope']['actor']['type'];

    @Column({ name: 'actor_id', type: 'varchar', nullable: false })
    public actorId!: AnyOutboxRecord['envelope']['actor']['id'];

    @Column({ type: 'jsonb', nullable: false })
    public envelope!: AnyOutboxRecord['envelope'];

    @Column({ name: 'created_at', type: 'timestamptz', nullable: false })
    public createdAt!: Date;
}

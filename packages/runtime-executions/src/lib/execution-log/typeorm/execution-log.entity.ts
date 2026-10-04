import type { ExecutionId } from '@event-driven-platform/execution';
import type { AnyExecutionLogEntry, ExecutionAttempt } from '@event-driven-platform/execution-log';
import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity('execution_log')
@Unique('uq_execution_log_intent_id', ['intentId'])
@Index('idx_execution_log_operation_created_at', ['operationName', 'createdAt'])
@Index('idx_execution_log_tenant_created_at', ['tenantType', 'tenantId', 'createdAt'])
@Index('idx_execution_log_aggregate_created_at', [
    'aggregateType',
    'aggregateId',
    'createdAt',
])
@Index('idx_execution_log_actor_created_at', ['actorType', 'actorId', 'createdAt'])
@Check('ck_execution_log_attempt_count', '"attempt_count" >= 1')
@Check(
    'ck_execution_log_state',
    `(
        "status" = 'in-progress'
        AND "result" IS NULL
        AND "finished_at" IS NULL
    ) OR (
        "status" = 'completed'
        AND "result" IS NOT NULL
        AND "finished_at" IS NOT NULL
    ) OR (
        "status" IN ('failed', 'timed-out')
        AND "result" IS NULL
        AND "finished_at" IS NOT NULL
    )`,
)
export class ExecutionLogEntity {
    @PrimaryColumn({ name: 'execution_id', type: 'uuid' })
    public executionId!: ExecutionId;

    @Column({ name: 'intent_id', type: 'varchar', nullable: false })
    public intentId!: string;

    @Column({ name: 'operation_name', type: 'varchar', nullable: false })
    public operationName!: string;

    @Column({ name: 'operation_schema_version', type: 'integer', nullable: false })
    public operationSchemaVersion!: number;

    @Column({ name: 'tenant_type', type: 'varchar', nullable: false })
    public tenantType!: string;

    @Column({ name: 'tenant_id', type: 'varchar', nullable: false })
    public tenantId!: string;

    @Column({ name: 'aggregate_type', type: 'varchar', nullable: false })
    public aggregateType!: string;

    @Column({ name: 'aggregate_id', type: 'varchar', nullable: false })
    public aggregateId!: string;

    @Column({ name: 'actor_type', type: 'varchar', nullable: false })
    public actorType!: string;

    @Column({ name: 'actor_id', type: 'varchar', nullable: false })
    public actorId!: string;

    @Column({ type: 'jsonb', nullable: false })
    public operation!: AnyExecutionLogEntry['operation'];

    @Column({ type: 'varchar', nullable: false })
    public status!: ExecutionAttempt['status'];

    @Column({ name: 'attempt_count', type: 'integer', nullable: false })
    public attemptCount!: number;

    @Column({ type: 'jsonb', nullable: true })
    public result!: AnyExecutionLogEntry['result'];

    @Column({ name: 'created_at', type: 'timestamptz', nullable: false })
    public createdAt!: Date;

    @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
    public finishedAt!: Date | null;
}

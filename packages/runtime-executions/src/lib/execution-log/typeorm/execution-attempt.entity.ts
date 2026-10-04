import type {
    ExecutionAttemptId,
    ExecutionId,
    ExecutionLeaseOwnerId,
    ExecutionLeaseVersion,
} from '@event-driven-platform/execution';
import type { ExecutionAttempt } from '@event-driven-platform/execution-log';
import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity('execution_attempt')
@Unique('uq_execution_attempt_number', ['executionId', 'attemptNumber'])
@Unique('uq_execution_attempt_lease_version', ['executionId', 'leaseVersion'])
@Index('idx_execution_attempt_correlation_id', ['correlationId'])
@Check(
    'ck_execution_attempt_state',
    `(
        "status" = 'in-progress'
        AND "failure" IS NULL
        AND "finished_at" IS NULL
    ) OR (
        "status" = 'completed'
        AND "failure" IS NULL
        AND "finished_at" IS NOT NULL
    ) OR (
        "status" IN ('failed', 'timed-out')
        AND "failure" IS NOT NULL
        AND "finished_at" IS NOT NULL
    )`,
)
export class ExecutionAttemptEntity {
    @PrimaryColumn({ name: 'attempt_id', type: 'uuid' })
    public attemptId!: ExecutionAttemptId;

    @Column({ name: 'execution_id', type: 'uuid', nullable: false })
    public executionId!: ExecutionId;

    @Column({ name: 'attempt_number', type: 'integer', nullable: false })
    public attemptNumber!: number;

    @Column({ name: 'status', type: 'varchar', nullable: false })
    public status!: ExecutionAttempt['status'];

    @Column({ name: 'correlation_id', type: 'varchar', nullable: false })
    public correlationId!: string;

    @Column({ name: 'runner_id', type: 'varchar', nullable: false })
    public runnerId!: ExecutionLeaseOwnerId;

    @Column({ name: 'lease_version', type: 'integer', nullable: false })
    public leaseVersion!: ExecutionLeaseVersion;

    @Column({ name: 'lease_acquired_at', type: 'timestamptz', nullable: false })
    public leaseAcquiredAt!: Date;

    @Column({ name: 'lease_expires_at', type: 'timestamptz', nullable: false })
    public leaseExpiresAt!: Date;

    @Column({ name: 'started_at', type: 'timestamptz', nullable: false })
    public startedAt!: Date;

    @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
    public finishedAt!: Date | null;

    @Column({ type: 'jsonb', nullable: true })
    public failure!: ExecutionAttempt['failure'];
}

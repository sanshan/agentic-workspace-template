import type {
    ExecutionId,
    ExecutionLeaseOwnerId,
    ExecutionLeaseVersion,
} from '@event-driven-platform/execution';
import type { Intent } from '@event-driven-platform/intent';
import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';

export type UseCaseExecutionStatus = 'in-progress' | 'released' | 'completed';

@Entity('use_case_execution')
@Unique('uq_use_case_execution_intent_id', ['intentId'])
@Check('ck_use_case_execution_lease_version', '"lease_version" >= 1')
@Check(
    'ck_use_case_execution_state',
    `(
        "status" = 'in-progress'
        AND "lease_owner_id" IS NOT NULL
        AND "lease_acquired_at" IS NOT NULL
        AND "lease_expires_at" IS NOT NULL
        AND "result" IS NULL
        AND "released_at" IS NULL
        AND "completed_at" IS NULL
    ) OR (
        "status" = 'released'
        AND "lease_owner_id" IS NULL
        AND "lease_acquired_at" IS NULL
        AND "lease_expires_at" IS NULL
        AND "result" IS NULL
        AND "released_at" IS NOT NULL
        AND "completed_at" IS NULL
    ) OR (
        "status" = 'completed'
        AND "lease_owner_id" IS NULL
        AND "lease_acquired_at" IS NULL
        AND "lease_expires_at" IS NULL
        AND "released_at" IS NULL
        AND "completed_at" IS NOT NULL
    )`,
)
export class UseCaseExecutionEntity {
    @PrimaryColumn({ name: 'execution_id', type: 'uuid' })
    public executionId!: ExecutionId;

    @Column({ name: 'intent_id', type: 'varchar', nullable: false })
    public intentId!: string;

    @Column({ name: 'parent_intent_id', type: 'varchar', nullable: true })
    public parentIntentId!: string | null;

    @Column({ type: 'jsonb', nullable: false })
    public intent!: Intent;

    @Column({ name: 'correlation_id', type: 'varchar', nullable: false })
    public correlationId!: string;

    @Column({ type: 'varchar', nullable: false })
    public status!: UseCaseExecutionStatus;

    @Column({ name: 'lease_owner_id', type: 'varchar', nullable: true })
    public leaseOwnerId!: ExecutionLeaseOwnerId | null;

    @Column({ name: 'lease_version', type: 'integer', nullable: false })
    public leaseVersion!: ExecutionLeaseVersion;

    @Column({ name: 'lease_acquired_at', type: 'timestamptz', nullable: true })
    public leaseAcquiredAt!: Date | null;

    @Column({ name: 'lease_expires_at', type: 'timestamptz', nullable: true })
    public leaseExpiresAt!: Date | null;

    @Column({ type: 'jsonb', nullable: true })
    public result!: unknown;

    @Column({ name: 'created_at', type: 'timestamptz', nullable: false })
    public createdAt!: Date;

    @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
    public releasedAt!: Date | null;

    @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
    public completedAt!: Date | null;
}

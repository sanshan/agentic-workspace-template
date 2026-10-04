import {
    DefaultExecutionAttemptIdFactory,
    type ExecutionFailure,
    type ExecutionId,
    type ExecutionLeaseVersion,
} from '@event-driven-platform/execution';
import type { AnyExecutionLogEntry } from '@event-driven-platform/execution-log';
import type {
    ClaimExecutionRequest,
    ClaimExecutionResult,
    CompleteExecutionRequest,
    CompleteExecutionResult,
    ExecutionLogStore,
    FailExecutionRequest,
    FailExecutionResult,
} from '@event-driven-platform/execution-log-store';
import type { AnyOperation } from '@event-driven-platform/operation';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import { ExecutionAttemptEntity } from './execution-attempt.entity.js';
import {
    mapCompletedExecutionLogEntry,
    mapExecutionLogEntry,
    mapFailedExecutionLogEntry,
    mapInProgressExecutionLogEntry,
} from './execution-log-entry.mapper.js';
import { ExecutionLogEntity } from './execution-log.entity.js';

const EXPIRED_LEASE_FAILURE: ExecutionFailure = {
    code: 'execution-lease-expired',
    message: 'Execution lease expired before the execution was reclaimed.',
    retryable: true,
};

function hasSameExecutionIdentity(
    persisted: ExecutionLogEntity,
    requested: AnyOperation,
): boolean {
    return (
        persisted.operationName === requested.name &&
        persisted.operationSchemaVersion === requested.schemaVersion &&
        persisted.tenantType === requested.tenant.type &&
        persisted.tenantId === requested.tenant.id &&
        persisted.actorType === requested.actor.type &&
        persisted.actorId === requested.actor.id
    );
}

interface LockedExecution {
    readonly execution: ExecutionLogEntity;
    readonly attempt: ExecutionAttemptEntity;
}

export class TypeOrmExecutionLogStore implements ExecutionLogStore {
    private readonly executionRepository: Repository<ExecutionLogEntity>;

    private readonly attemptRepository: Repository<ExecutionAttemptEntity>;

    private readonly attemptIdFactory = new DefaultExecutionAttemptIdFactory();

    public constructor(dataSource: DataSource) {
        this.executionRepository = dataSource.getRepository(ExecutionLogEntity);
        this.attemptRepository = dataSource.getRepository(ExecutionAttemptEntity);
    }

    public claim<TOperation extends AnyOperation>(
        request: ClaimExecutionRequest<TOperation>,
    ): Promise<ClaimExecutionResult<TOperation>> {
        return this.executionRepository.manager.transaction(async (manager) => {
            const executions = manager.getRepository(ExecutionLogEntity);
            const attempts = manager.getRepository(ExecutionAttemptEntity);
            const requestedAt = new Date(request.requestedAt);

            await manager.query(
                `
                    INSERT INTO "execution_log" (
                        "execution_id",
                        "intent_id",
                        "operation_name",
                        "operation_schema_version",
                        "tenant_type",
                        "tenant_id",
                        "aggregate_type",
                        "aggregate_id",
                        "actor_type",
                        "actor_id",
                        "operation",
                        "status",
                        "attempt_count",
                        "result",
                        "created_at",
                        "finished_at"
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8,
                        $9, $10, $11, 'in-progress', 1, NULL, $12, NULL
                    )
                    ON CONFLICT DO NOTHING
                `,
                [
                    request.executionId,
                    request.operation.intent.id,
                    request.operation.name,
                    request.operation.schemaVersion,
                    request.operation.tenant.type,
                    request.operation.tenant.id,
                    request.operation.aggregate.type,
                    request.operation.aggregate.id,
                    request.operation.actor.type,
                    request.operation.actor.id,
                    request.operation,
                    requestedAt,
                ],
            );

            const execution = await executions.findOne({
                where: { intentId: request.operation.intent.id },
                lock: { mode: 'pessimistic_write' },
            });

            if (!execution) {
                throw new Error(
                    `Execution ${request.executionId} could not be claimed because its persisted identity conflicts with another Intent.`,
                );
            }

            const latestAttempt = await attempts.findOne({
                where: { executionId: execution.executionId },
                order: { attemptNumber: 'DESC' },
                lock: { mode: 'pessimistic_write' },
            });

            if (!latestAttempt) {
                if (
                    execution.executionId !== request.executionId ||
                    !hasSameExecutionIdentity(execution, request.operation)
                ) {
                    throw new Error(
                        `Execution ${execution.executionId} has no persisted attempt for its existing Intent.`,
                    );
                }

                const firstAttempt = this.createAttempt(
                    attempts,
                    request,
                    1,
                    1 as ExecutionLeaseVersion,
                    requestedAt,
                );

                await attempts.insert(firstAttempt);

                return {
                    type: 'claimed',
                    entry: mapInProgressExecutionLogEntry<TOperation>(execution, firstAttempt),
                };
            }

            if (
                execution.executionId !== request.executionId ||
                !hasSameExecutionIdentity(execution, request.operation)
            ) {
                return {
                    type: 'intent-conflict',
                    entry: mapExecutionLogEntry<AnyOperation>(execution, latestAttempt),
                };
            }

            if (execution.status === 'completed') {
                return {
                    type: 'completed',
                    entry: mapCompletedExecutionLogEntry<TOperation>(execution, latestAttempt),
                };
            }

            if (execution.status === 'in-progress') {
                const current = mapInProgressExecutionLogEntry<TOperation>(
                    execution,
                    latestAttempt,
                );

                if (latestAttempt.leaseExpiresAt.getTime() > requestedAt.getTime()) {
                    return {
                        type: 'already-in-progress',
                        entry: current,
                    };
                }

                latestAttempt.status = 'timed-out';
                latestAttempt.failure = EXPIRED_LEASE_FAILURE;
                latestAttempt.finishedAt = requestedAt;
                await attempts.save(latestAttempt);
            } else {
                mapFailedExecutionLogEntry<TOperation>(execution, latestAttempt);
            }

            const attemptNumber = execution.attemptCount + 1;
            const leaseVersion = (Number(latestAttempt.leaseVersion) +
                1) as ExecutionLeaseVersion;
            const nextAttempt = this.createAttempt(
                attempts,
                request,
                attemptNumber,
                leaseVersion,
                requestedAt,
            );

            execution.status = 'in-progress';
            execution.attemptCount = attemptNumber;
            execution.result = null;
            execution.finishedAt = null;

            await executions.save(execution);
            await attempts.insert(nextAttempt);

            return {
                type: 'claimed',
                entry: mapInProgressExecutionLogEntry<TOperation>(execution, nextAttempt),
            };
        });
    }

    public complete<TOperation extends AnyOperation>(
        request: CompleteExecutionRequest<TOperation>,
    ): Promise<CompleteExecutionResult<TOperation>> {
        return this.executionRepository.manager.transaction(async (manager) => {
            const locked = await this.lockExecution(manager, request.executionId);

            if (!locked) {
                return { type: 'not-found' };
            }

            const { execution, attempt } = locked;

            if (execution.status !== 'in-progress' || attempt.status !== 'in-progress') {
                return {
                    type: 'not-in-progress',
                    entry: mapExecutionLogEntry<TOperation>(execution, attempt),
                };
            }

            if (!this.isCurrentLease(execution, attempt, request.attemptId, request.lease)) {
                return {
                    type: 'lease-conflict',
                    entry: mapInProgressExecutionLogEntry<TOperation>(execution, attempt),
                };
            }

            const finishedAt = new Date(request.finishedAt);
            attempt.status = 'completed';
            attempt.failure = null;
            attempt.finishedAt = finishedAt;
            execution.status = 'completed';
            execution.result = request.result;
            execution.finishedAt = finishedAt;

            await manager.getRepository(ExecutionAttemptEntity).save(attempt);
            await manager.getRepository(ExecutionLogEntity).save(execution);

            return {
                type: 'completed',
                entry: mapCompletedExecutionLogEntry<TOperation>(execution, attempt),
            };
        });
    }

    public fail<TOperation extends AnyOperation>(
        request: FailExecutionRequest,
    ): Promise<FailExecutionResult<TOperation>> {
        return this.executionRepository.manager.transaction(async (manager) => {
            const locked = await this.lockExecution(manager, request.executionId);

            if (!locked) {
                return { type: 'not-found' };
            }

            const { execution, attempt } = locked;

            if (execution.status !== 'in-progress' || attempt.status !== 'in-progress') {
                return {
                    type: 'not-in-progress',
                    entry: mapExecutionLogEntry<TOperation>(execution, attempt),
                };
            }

            if (!this.isCurrentLease(execution, attempt, request.attemptId, request.lease)) {
                return {
                    type: 'lease-conflict',
                    entry: mapInProgressExecutionLogEntry<TOperation>(execution, attempt),
                };
            }

            const finishedAt = new Date(request.finishedAt);
            attempt.status = request.status;
            attempt.failure = request.failure;
            attempt.finishedAt = finishedAt;
            execution.status = request.status;
            execution.result = null;
            execution.finishedAt = finishedAt;

            await manager.getRepository(ExecutionAttemptEntity).save(attempt);
            await manager.getRepository(ExecutionLogEntity).save(execution);

            return {
                type: 'failed',
                entry: mapFailedExecutionLogEntry<TOperation>(execution, attempt),
            };
        });
    }

    public async findByIntentId(intentId: string): Promise<AnyExecutionLogEntry | null> {
        const execution = await this.executionRepository.findOneBy({ intentId });

        if (!execution) {
            return null;
        }

        const attempt = await this.attemptRepository.findOne({
            where: { executionId: execution.executionId },
            order: { attemptNumber: 'DESC' },
        });

        if (!attempt) {
            throw new Error(`Execution ${execution.executionId} has no persisted attempt.`);
        }

        return mapExecutionLogEntry<AnyOperation>(execution, attempt);
    }

    private createAttempt<TOperation extends AnyOperation>(
        repository: Repository<ExecutionAttemptEntity>,
        request: ClaimExecutionRequest<TOperation>,
        attemptNumber: number,
        leaseVersion: ExecutionLeaseVersion,
        requestedAt: Date,
    ): ExecutionAttemptEntity {
        return repository.create({
            attemptId: this.attemptIdFactory.create({
                executionId: request.executionId,
                attemptNumber,
            }),
            executionId: request.executionId,
            attemptNumber,
            status: 'in-progress',
            correlationId: request.correlationId,
            runnerId: request.leaseOwnerId,
            leaseVersion,
            leaseAcquiredAt: requestedAt,
            leaseExpiresAt: new Date(requestedAt.getTime() + request.leaseDurationMs),
            startedAt: requestedAt,
            finishedAt: null,
            failure: null,
        });
    }

    private async lockExecution(
        manager: EntityManager,
        executionId: ExecutionId,
    ): Promise<LockedExecution | null> {
        const executions = manager.getRepository(ExecutionLogEntity);
        const attempts = manager.getRepository(ExecutionAttemptEntity);
        const execution = await executions.findOne({
            where: { executionId },
            lock: { mode: 'pessimistic_write' },
        });

        if (!execution) {
            return null;
        }

        const attempt = await attempts.findOne({
            where: { executionId },
            order: { attemptNumber: 'DESC' },
            lock: { mode: 'pessimistic_write' },
        });

        if (!attempt) {
            throw new Error(`Execution ${executionId} has no persisted attempt.`);
        }

        return { execution, attempt };
    }

    private isCurrentLease(
        execution: ExecutionLogEntity,
        attempt: ExecutionAttemptEntity,
        attemptId: ExecutionAttemptEntity['attemptId'],
        lease: {
            readonly ownerId: ExecutionAttemptEntity['runnerId'];
            readonly version: ExecutionLeaseVersion;
        },
    ): boolean {
        return (
            attempt.attemptNumber === execution.attemptCount &&
            attempt.attemptId === attemptId &&
            attempt.runnerId === lease.ownerId &&
            attempt.leaseVersion === lease.version
        );
    }
}

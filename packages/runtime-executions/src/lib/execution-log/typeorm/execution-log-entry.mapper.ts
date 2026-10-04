import type {
    CompletedExecutionLogEntry,
    ExecutionLogEntry,
    FailedExecutionLogEntry,
    InProgressExecutionLogEntry,
} from '@event-driven-platform/execution-log';
import type { AnyOperation, OperationResultOf } from '@event-driven-platform/operation';

import type { ExecutionAttemptEntity } from './execution-attempt.entity.js';
import type { ExecutionLogEntity } from './execution-log.entity.js';

function operationOf<TOperation extends AnyOperation>(entity: ExecutionLogEntity): TOperation {
    return entity.operation as TOperation;
}

function assertMatchingStatus(
    execution: ExecutionLogEntity,
    attempt: ExecutionAttemptEntity,
): void {
    if (execution.status !== attempt.status) {
        throw new Error(
            `Execution ${execution.executionId} latest attempt status ${attempt.status} does not match execution status ${execution.status}.`,
        );
    }
}

export function mapInProgressExecutionLogEntry<TOperation extends AnyOperation>(
    execution: ExecutionLogEntity,
    attempt: ExecutionAttemptEntity,
): InProgressExecutionLogEntry<TOperation> {
    if (
        execution.status !== 'in-progress' ||
        attempt.status !== 'in-progress' ||
        execution.result !== null ||
        execution.finishedAt !== null ||
        attempt.failure !== null ||
        attempt.finishedAt !== null
    ) {
        throw new Error(`Execution ${execution.executionId} has invalid in-progress persistence state.`);
    }

    return {
        executionId: execution.executionId,
        intentId: execution.intentId,
        operation: operationOf<TOperation>(execution),
        attemptCount: execution.attemptCount,
        createdAt: execution.createdAt.toISOString(),
        latestAttempt: {
            attemptId: attempt.attemptId,
            executionId: attempt.executionId,
            attemptNumber: attempt.attemptNumber,
            correlationId: attempt.correlationId,
            runnerId: attempt.runnerId,
            leaseVersion: attempt.leaseVersion,
            startedAt: attempt.startedAt.toISOString(),
            status: 'in-progress',
            failure: null,
            finishedAt: null,
        },
        lease: {
            ownerId: attempt.runnerId,
            version: attempt.leaseVersion,
            acquiredAt: attempt.leaseAcquiredAt.toISOString(),
            expiresAt: attempt.leaseExpiresAt.toISOString(),
        },
        result: null,
        finishedAt: null,
    };
}

export function mapCompletedExecutionLogEntry<TOperation extends AnyOperation>(
    execution: ExecutionLogEntity,
    attempt: ExecutionAttemptEntity,
): CompletedExecutionLogEntry<TOperation> {
    if (
        execution.status !== 'completed' ||
        attempt.status !== 'completed' ||
        execution.result === null ||
        execution.finishedAt === null ||
        attempt.failure !== null ||
        attempt.finishedAt === null
    ) {
        throw new Error(`Execution ${execution.executionId} has invalid completed persistence state.`);
    }

    return {
        executionId: execution.executionId,
        intentId: execution.intentId,
        operation: operationOf<TOperation>(execution),
        attemptCount: execution.attemptCount,
        createdAt: execution.createdAt.toISOString(),
        latestAttempt: {
            attemptId: attempt.attemptId,
            executionId: attempt.executionId,
            attemptNumber: attempt.attemptNumber,
            correlationId: attempt.correlationId,
            runnerId: attempt.runnerId,
            leaseVersion: attempt.leaseVersion,
            startedAt: attempt.startedAt.toISOString(),
            status: 'completed',
            failure: null,
            finishedAt: attempt.finishedAt.toISOString(),
        },
        lease: null,
        result: execution.result as OperationResultOf<TOperation>,
        finishedAt: execution.finishedAt.toISOString(),
    };
}

export function mapFailedExecutionLogEntry<TOperation extends AnyOperation>(
    execution: ExecutionLogEntity,
    attempt: ExecutionAttemptEntity,
): FailedExecutionLogEntry<TOperation> {
    if (
        (execution.status !== 'failed' && execution.status !== 'timed-out') ||
        execution.status !== attempt.status ||
        execution.result !== null ||
        execution.finishedAt === null ||
        attempt.failure === null ||
        attempt.finishedAt === null
    ) {
        throw new Error(`Execution ${execution.executionId} has invalid failed persistence state.`);
    }

    const attemptBase = {
        attemptId: attempt.attemptId,
        executionId: attempt.executionId,
        attemptNumber: attempt.attemptNumber,
        correlationId: attempt.correlationId,
        runnerId: attempt.runnerId,
        leaseVersion: attempt.leaseVersion,
        startedAt: attempt.startedAt.toISOString(),
        failure: attempt.failure,
        finishedAt: attempt.finishedAt.toISOString(),
    };

    return {
        executionId: execution.executionId,
        intentId: execution.intentId,
        operation: operationOf<TOperation>(execution),
        attemptCount: execution.attemptCount,
        createdAt: execution.createdAt.toISOString(),
        latestAttempt:
            attempt.status === 'failed'
                ? { ...attemptBase, status: 'failed' }
                : { ...attemptBase, status: 'timed-out' },
        lease: null,
        result: null,
        finishedAt: execution.finishedAt.toISOString(),
    };
}

export function mapExecutionLogEntry<TOperation extends AnyOperation>(
    execution: ExecutionLogEntity,
    attempt: ExecutionAttemptEntity,
): ExecutionLogEntry<TOperation> {
    assertMatchingStatus(execution, attempt);

    switch (execution.status) {
        case 'in-progress':
            return mapInProgressExecutionLogEntry<TOperation>(execution, attempt);
        case 'completed':
            return mapCompletedExecutionLogEntry<TOperation>(execution, attempt);
        case 'failed':
        case 'timed-out':
            return mapFailedExecutionLogEntry<TOperation>(execution, attempt);
    }
}

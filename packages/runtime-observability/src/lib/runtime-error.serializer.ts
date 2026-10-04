import { ExecutionFailureError } from '@event-driven-platform/execution';

export interface SerializedRuntimeExecutionFailure {
    readonly code: string;
    readonly retryable: boolean;
}

export interface SerializedRuntimeError {
    readonly type: string;
    readonly message: string;
    readonly stack?: string;
    readonly executionFailure?: SerializedRuntimeExecutionFailure;
    readonly cause?: SerializedRuntimeError;
}

const MAX_ERROR_CAUSE_DEPTH = 5;

export function serializeRuntimeError(value: unknown): SerializedRuntimeError {
    return serializeErrorValue(value, 0, false);
}

function serializeErrorValue(
    value: unknown,
    depth: number,
    isCause: boolean,
): SerializedRuntimeError {
    if (depth > MAX_ERROR_CAUSE_DEPTH) {
        return {
            type: 'ErrorCauseTruncated',
            message: 'Error cause chain truncated.',
        };
    }

    if (!(value instanceof Error)) {
        return {
            type: isCause ? 'NonErrorCause' : 'NonErrorThrownValue',
            message: isCause
                ? 'Non-Error cause omitted from structured diagnostics.'
                : 'Non-Error thrown value omitted from structured diagnostics.',
        };
    }

    const serialized: {
        type: string;
        message: string;
        stack?: string;
        executionFailure?: SerializedRuntimeExecutionFailure;
        cause?: SerializedRuntimeError;
    } = {
        type: value.name || value.constructor.name || 'Error',
        message: value.message,
    };

    if (value.stack) {
        serialized.stack = value.stack;
    }

    if (value instanceof ExecutionFailureError) {
        serialized.executionFailure = {
            code: value.executionFailure.code,
            retryable: value.executionFailure.retryable,
        };
    }

    if (value.cause !== undefined) {
        serialized.cause = serializeErrorValue(value.cause, depth + 1, true);
    }

    return serialized;
}

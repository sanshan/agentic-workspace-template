import type { ExecutionFailure } from '@event-driven-platform/execution';
import { HttpStatus } from '@nestjs/common';

import {
    INTERNAL_HTTP_PROBLEM,
} from './http-problems.js';
import { defineHttpProblem, type HttpProblemDefinition } from './problem-details.js';

const EXECUTION_FAILURE_HTTP_PROBLEMS: Readonly<Record<string, HttpProblemDefinition>> =
    Object.freeze({
        'guard-rejected': defineHttpProblem(
            'guard-rejected',
            HttpStatus.FORBIDDEN,
            'Execution Forbidden',
        ),
        'rate-limit-rejected': defineHttpProblem(
            'rate-limit-rejected',
            HttpStatus.TOO_MANY_REQUESTS,
            'Too Many Requests',
        ),
        'already-in-progress': defineHttpProblem(
            'already-in-progress',
            HttpStatus.CONFLICT,
            'Execution Already in Progress',
        ),
        'intent-conflict': defineHttpProblem(
            'intent-conflict',
            HttpStatus.CONFLICT,
            'Execution Conflict',
        ),
        'execution-timed-out': defineHttpProblem(
            'execution-timed-out',
            HttpStatus.SERVICE_UNAVAILABLE,
            'Service Unavailable',
        ),
        'read-timed-out': defineHttpProblem(
            'read-timed-out',
            HttpStatus.SERVICE_UNAVAILABLE,
            'Service Unavailable',
        ),
    });

export function mapExecutionFailureToHttpProblem(
    failure: ExecutionFailure,
): HttpProblemDefinition {
    return EXECUTION_FAILURE_HTTP_PROBLEMS[failure.code] ?? INTERNAL_HTTP_PROBLEM;
}

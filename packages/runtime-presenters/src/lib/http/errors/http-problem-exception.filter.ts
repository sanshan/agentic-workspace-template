import { getActiveTraceLogFields } from '@agentic-workspace/runtime-observability';
import { RuntimePinoLogger } from '@agentic-workspace/runtime-observability/nest';
import { ExecutionFailureError } from '@event-driven-platform/execution';
import {
    Catch,
    HttpException,
    Injectable,
    type ArgumentsHost,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

import { mapExecutionFailureToHttpProblem } from './execution-failure-http-mapping.js';
import { mapHttpStatusToProblem } from './http-exception-http-mapping.js';
import { INTERNAL_HTTP_PROBLEM } from './http-problems.js';
import { HttpProblemException } from './http-problem.exception.js';
import {
    createProblemDetails,
    PROBLEM_DETAILS_MEDIA_TYPE,
    type HttpProblemDefinition,
} from './problem-details.js';

interface ResolvedHttpProblem {
    readonly definition: HttpProblemDefinition;
    readonly detail?: string;
    readonly expected: boolean;
}

@Catch()
@Injectable()
export class HttpProblemExceptionFilter extends BaseExceptionFilter {
    public constructor(
        private readonly adapterHost: HttpAdapterHost,
        private readonly logger: RuntimePinoLogger,
    ) {
        super(adapterHost.httpAdapter);
    }

    public override catch(exception: unknown, host: ArgumentsHost): void {
        const resolved = this.resolveProblem(exception);
        const traceId = getActiveTraceLogFields()?.traceId;
        const problem = createProblemDetails(resolved.definition, {
            ...(resolved.detail ? { detail: resolved.detail } : {}),
            ...(traceId ? { traceId } : {}),
        });

        this.logTerminalException(exception, resolved);

        const response = host.switchToHttp().getResponse();
        const adapter = this.adapterHost.httpAdapter;
        adapter.setHeader(response, 'Content-Type', PROBLEM_DETAILS_MEDIA_TYPE);
        adapter.reply(response, problem, resolved.definition.status);
    }

    private resolveProblem(exception: unknown): ResolvedHttpProblem {
        if (exception instanceof HttpProblemException) {
            return {
                definition: exception.definition,
                detail: exception.problemOptions.detail,
                expected: true,
            };
        }

        if (exception instanceof ExecutionFailureError) {
            return {
                definition: mapExecutionFailureToHttpProblem(exception.executionFailure),
                expected: false,
            };
        }

        if (exception instanceof HttpException) {
            return {
                definition: mapHttpStatusToProblem(exception.getStatus()),
                expected: exception.getStatus() < 500,
            };
        }

        return {
            definition: INTERNAL_HTTP_PROBLEM,
            expected: false,
        };
    }

    private logTerminalException(exception: unknown, resolved: ResolvedHttpProblem): void {
        if (resolved.expected) {
            return;
        }

        if (resolved.definition.status >= 500) {
            this.logger.error({ err: exception }, 'HTTP request failed');
            return;
        }

        if (exception instanceof ExecutionFailureError) {
            this.logger.warn({ err: exception }, 'HTTP request rejected');
        }
    }
}

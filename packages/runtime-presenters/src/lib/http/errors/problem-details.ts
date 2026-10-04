export const PROBLEM_DETAILS_MEDIA_TYPE = 'application/problem+json';

const PROBLEM_TYPE_PREFIX = 'urn:agentic-workspace:problem:';

export interface HttpProblemDefinition {
    readonly code: string;
    readonly status: number;
    readonly title: string;
    readonly type: string;
}

export interface ProblemDetails {
    readonly type: string;
    readonly title: string;
    readonly status: number;
    readonly code: string;
    readonly detail?: string;
    readonly traceId?: string;
}

export interface ProblemDetailsOptions {
    readonly detail?: string;
    readonly traceId?: string;
}

export function defineHttpProblem(
    code: string,
    status: number,
    title: string,
): HttpProblemDefinition {
    return Object.freeze({
        code,
        status,
        title,
        type: `${PROBLEM_TYPE_PREFIX}${code}`,
    });
}

export function createProblemDetails(
    definition: HttpProblemDefinition,
    options: ProblemDetailsOptions = {},
): ProblemDetails {
    return {
        type: definition.type,
        title: definition.title,
        status: definition.status,
        code: definition.code,
        ...(options.detail ? { detail: options.detail } : {}),
        ...(options.traceId ? { traceId: options.traceId } : {}),
    };
}

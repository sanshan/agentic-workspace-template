import { applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

import type { HttpProblemDefinition } from '../errors/problem-details.js';

export const API_ENDPOINT_ERRORS_EXTENSION = 'x-agentic-workspace-endpoint-errors';

export interface ApiEndpointOptions {
    readonly errors: readonly HttpProblemDefinition[];
}

export interface ApiEndpointErrorsExtension {
    readonly errors: readonly HttpProblemDefinition[];
}

export function ApiEndpoint(options: ApiEndpointOptions): MethodDecorator {
    const extension: ApiEndpointErrorsExtension = {
        errors: [...options.errors],
    };

    return applyDecorators(ApiExtension(API_ENDPOINT_ERRORS_EXTENSION, extension));
}

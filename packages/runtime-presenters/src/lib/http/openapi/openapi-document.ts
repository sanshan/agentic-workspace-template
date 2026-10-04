import type { INestApplication } from '@nestjs/common';
import {
    SwaggerModule,
    type OpenAPIObject,
    type OperationObject,
    type PathItemObject,
    type ResponseObject,
    type SchemaObject,
    type SwaggerDocumentOptions,
} from '@nestjs/swagger';

import {
    PROBLEM_DETAILS_MEDIA_TYPE,
    type HttpProblemDefinition,
} from '../errors/problem-details.js';
import {
    API_ENDPOINT_ERRORS_EXTENSION,
    type ApiEndpointErrorsExtension,
} from './api-endpoint.js';

const HTTP_METHODS = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
] as const satisfies readonly (keyof PathItemObject)[];

type ApiEndpointOperation = OperationObject & {
    [API_ENDPOINT_ERRORS_EXTENSION]?: ApiEndpointErrorsExtension;
};

export function createOpenApiDocument(
    app: INestApplication,
    config: Omit<OpenAPIObject, 'paths'>,
    options: SwaggerDocumentOptions = {},
): OpenAPIObject {
    return projectApiEndpointErrors(SwaggerModule.createDocument(app, config, options));
}

function projectApiEndpointErrors(document: OpenAPIObject): OpenAPIObject {
    for (const pathItem of Object.values(document.paths)) {
        for (const method of HTTP_METHODS) {
            const operation = pathItem[method] as ApiEndpointOperation | undefined;
            const extension = operation?.[API_ENDPOINT_ERRORS_EXTENSION];
            if (!operation || !extension) {
                continue;
            }

            addErrorResponses(operation, extension.errors);
            delete operation[API_ENDPOINT_ERRORS_EXTENSION];
        }
    }

    return document;
}

function addErrorResponses(
    operation: OperationObject,
    definitions: readonly HttpProblemDefinition[],
): void {
    const definitionsByStatus = new Map<number, HttpProblemDefinition[]>();

    for (const definition of definitions) {
        const statusDefinitions = definitionsByStatus.get(definition.status) ?? [];
        if (!statusDefinitions.some((candidate) => candidate.code === definition.code)) {
            statusDefinitions.push(definition);
        }
        definitionsByStatus.set(definition.status, statusDefinitions);
    }

    for (const [status, statusDefinitions] of definitionsByStatus) {
        const statusKey = String(status);
        if (operation.responses[statusKey] !== undefined) {
            throw new Error(
                `@ApiEndpoint error status ${statusKey} conflicts with existing OpenAPI response metadata`,
            );
        }

        operation.responses[statusKey] = createProblemResponse(statusDefinitions);
    }
}

function createProblemResponse(
    definitions: readonly HttpProblemDefinition[],
): ResponseObject {
    const [firstSchema, ...otherSchemas] = definitions.map(createProblemSchema);
    if (!firstSchema) {
        throw new Error('@ApiEndpoint cannot project an empty HTTP problem response');
    }

    return {
        description: definitions.map((definition) => definition.title).join(' / '),
        content: {
            [PROBLEM_DETAILS_MEDIA_TYPE]: {
                schema:
                    otherSchemas.length === 0
                        ? firstSchema
                        : { oneOf: [firstSchema, ...otherSchemas] },
            },
        },
    };
}

function createProblemSchema(definition: HttpProblemDefinition): SchemaObject {
    return {
        type: 'object',
        required: ['type', 'title', 'status', 'code'],
        properties: {
            type: { type: 'string', enum: [definition.type] },
            title: { type: 'string', enum: [definition.title] },
            status: { type: 'integer', enum: [definition.status] },
            code: { type: 'string', enum: [definition.code] },
            detail: { type: 'string' },
            traceId: { type: 'string' },
        },
    };
}

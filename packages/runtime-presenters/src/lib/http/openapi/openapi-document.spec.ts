import { HttpStatus, Controller, Get, HttpCode, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    CONFLICT_HTTP_PROBLEM,
    defineHttpProblem,
    NOT_FOUND_HTTP_PROBLEM,
    PROBLEM_DETAILS_MEDIA_TYPE,
} from '../../../http/errors.js';
import { HttpHealthModule } from '../../../http/health.js';
import { ApiEndpoint, createOpenApiDocument } from '../../../http/openapi.js';

const VERSION_CONFLICT_HTTP_PROBLEM = defineHttpProblem(
    'version-conflict',
    HttpStatus.CONFLICT,
    'Version Conflict',
);

@Controller('business')
class BusinessController {
    @Get('document')
    @ApiEndpoint({ errors: [NOT_FOUND_HTTP_PROBLEM] })
    getDocument() {
        return { id: 'document-id' };
    }

    @Post('document')
    @ApiEndpoint({ errors: [CONFLICT_HTTP_PROBLEM] })
    createDocument() {
        return { id: 'document-id' };
    }

    @Post('accepted')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiEndpoint({ errors: [CONFLICT_HTTP_PROBLEM] })
    acceptDocument() {
        return { accepted: true };
    }

    @Get('conflicts')
    @ApiEndpoint({
        errors: [CONFLICT_HTTP_PROBLEM, VERSION_CONFLICT_HTTP_PROBLEM],
    })
    conflicts() {
        return { ok: true };
    }
}

describe('OpenAPI endpoint contract', () => {
    let app: INestApplication;
    let document: OpenAPIObject;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [
                HttpHealthModule.register({
                    readinessChecks: {
                        useFactory: () => [],
                    },
                }),
            ],
            controllers: [BusinessController],
        }).compile();

        app = module.createNestApplication();
        await app.init();

        document = createOpenApiDocument(
            app,
            new DocumentBuilder().setTitle('test').setVersion('1').build(),
        );
    });

    afterAll(async () => {
        await app.close();
    });

    it('keeps Nest and Swagger as the source of successful response statuses', () => {
        expect(document.paths['/business/document']?.get?.responses['200']).toEqual({
            description: '',
        });
        expect(document.paths['/business/document']?.post?.responses['201']).toEqual({
            description: '',
        });
        expect(document.paths['/business/accepted']?.post?.responses['202']).toEqual({
            description: '',
        });
    });

    it('projects endpoint-specific canonical problems without exposing projection metadata', () => {
        const operation = document.paths['/business/document']?.get;
        const response = operation?.responses['404'];

        expect(response).toMatchObject({
            description: NOT_FOUND_HTTP_PROBLEM.title,
            content: {
                [PROBLEM_DETAILS_MEDIA_TYPE]: {
                    schema: {
                        type: 'object',
                        required: ['type', 'title', 'status', 'code'],
                        properties: {
                            type: { type: 'string', enum: [NOT_FOUND_HTTP_PROBLEM.type] },
                            title: { type: 'string', enum: [NOT_FOUND_HTTP_PROBLEM.title] },
                            status: { type: 'integer', enum: [NOT_FOUND_HTTP_PROBLEM.status] },
                            code: { type: 'string', enum: [NOT_FOUND_HTTP_PROBLEM.code] },
                            detail: { type: 'string' },
                            traceId: { type: 'string' },
                        },
                    },
                },
            },
        });
        expect(Object.keys(operation ?? {})).not.toContain('x-agentic-workspace-endpoint-errors');
    });

    it('groups multiple problem variants sharing one HTTP status into one response', () => {
        const response = document.paths['/business/conflicts']?.get?.responses['409'];

        expect(response).toMatchObject({
            content: {
                [PROBLEM_DETAILS_MEDIA_TYPE]: {
                    schema: {
                        oneOf: [
                            {
                                properties: {
                                    code: { enum: [CONFLICT_HTTP_PROBLEM.code] },
                                },
                            },
                            {
                                properties: {
                                    code: { enum: [VERSION_CONFLICT_HTTP_PROBLEM.code] },
                                },
                            },
                        ],
                    },
                },
            },
        });
    });

    it('leaves the shared operational health contract outside ApiEndpoint', () => {
        const liveness = document.paths['/health/live']?.get;
        const successResponse = liveness?.responses['200'];

        expect(successResponse).toMatchObject({
            description: 'The Health Check is successful',
            content: {
                'application/json': {
                    schema: { type: 'object' },
                },
            },
        });
        expect(successResponse).not.toHaveProperty(`content.${PROBLEM_DETAILS_MEDIA_TYPE}`);
        expect(Object.keys(liveness ?? {})).not.toContain('x-agentic-workspace-endpoint-errors');
        expect(liveness?.responses['400']).toBeUndefined();
        expect(liveness?.responses['500']).toBeUndefined();
    });
});

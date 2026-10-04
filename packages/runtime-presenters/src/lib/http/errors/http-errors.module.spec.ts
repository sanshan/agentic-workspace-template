import { RuntimeObservabilityModule, RuntimePinoLogger } from '@agentic-workspace/runtime-observability/nest';
import { ExecutionFailureError } from '@event-driven-platform/execution';
import {
    BadRequestException,
    Controller,
    Get,
    type INestApplication,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpProblemException, NOT_FOUND_HTTP_PROBLEM } from '../../../http/errors.js';
import { HttpErrorsModule } from '../../../http/errors/nest.js';
import { HttpHealthModule } from '../../../http/health.js';

@Controller('test-errors')
class TestErrorsController {
    @Get('execution-failure')
    executionFailure(): never {
        throw new ExecutionFailureError(
            {
                code: 'guard-rejected',
                message: 'internal guard detail',
                retryable: false,
            },
            { cause: new Error('sensitive guard cause') },
        );
    }

    @Get('bad-request')
    badRequest(): never {
        throw new BadRequestException('sensitive validation detail');
    }

    @Get('expected-not-found')
    expectedNotFound(): never {
        throw new HttpProblemException(NOT_FOUND_HTTP_PROBLEM, {
            detail: 'Document was not found.',
        });
    }

    @Get('unknown')
    unknown(): never {
        throw new Error('sensitive internal failure');
    }
}

describe('HttpErrorsModule', () => {
    let app: INestApplication;
    const logger = {
        error: vi.fn(),
        warn: vi.fn(),
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            imports: [
                RuntimeObservabilityModule.register({
                    service: { name: 'runtime-presenters-test' },
                    level: 'silent',
                }),
                HttpErrorsModule,
                HttpHealthModule.register({
                    readinessChecks: {
                        useFactory: () => [
                            {
                                name: 'dependency',
                                check: async () => {
                                    throw new Error('sensitive readiness failure');
                                },
                            },
                        ],
                    },
                }),
            ],
            controllers: [TestErrorsController],
        })
            .overrideProvider(RuntimePinoLogger)
            .useValue(logger)
            .compile();

        app = module.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('maps a classified EDP failure by code without exposing its diagnostics', async () => {
        const response = await request(app.getHttpServer())
            .get('/test-errors/execution-failure')
            .expect(403);

        expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
        expect(response.body).toEqual({
            type: 'urn:agentic-workspace:problem:guard-rejected',
            title: 'Execution Forbidden',
            status: 403,
            code: 'guard-rejected',
        });
        expect(JSON.stringify(response.body)).not.toContain('internal guard detail');
        expect(JSON.stringify(response.body)).not.toContain('sensitive guard cause');
        expect(logger.warn).toHaveBeenCalledOnce();
        expect(logger.warn.mock.calls[0]?.[0]).toEqual({
            err: expect.any(ExecutionFailureError),
        });
    });

    it('maps ordinary Nest client exceptions to the shared envelope without logging them as server errors', async () => {
        const response = await request(app.getHttpServer())
            .get('/test-errors/bad-request')
            .expect(400);

        expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
        expect(response.body).toEqual({
            type: 'urn:agentic-workspace:problem:invalid-request',
            title: 'Invalid Request',
            status: 400,
            code: 'invalid-request',
        });
        expect(JSON.stringify(response.body)).not.toContain('sensitive validation detail');
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('renders explicitly selected presenter problems without converting them into EDP failures', async () => {
        const response = await request(app.getHttpServer())
            .get('/test-errors/expected-not-found')
            .expect(404);

        expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
        expect(response.body).toEqual({
            type: 'urn:agentic-workspace:problem:not-found',
            title: 'Not Found',
            status: 404,
            code: 'not-found',
            detail: 'Document was not found.',
        });
        expect(logger.error).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('renders unknown exceptions as safe internal problems and logs the terminal occurrence once', async () => {
        const response = await request(app.getHttpServer())
            .get('/test-errors/unknown')
            .expect(500);

        expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
        expect(response.body).toEqual({
            type: 'urn:agentic-workspace:problem:internal-error',
            title: 'Internal Server Error',
            status: 500,
            code: 'internal-error',
        });
        expect(JSON.stringify(response.body)).not.toContain('sensitive internal failure');
        expect(logger.error).toHaveBeenCalledOnce();
        expect(logger.error.mock.calls[0]?.[0]).toEqual({ err: expect.any(Error) });
    });

    it('preserves the Terminus-owned health response through the health adapter boundary', async () => {
        const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

        expect(response.headers['content-type']).not.toMatch(/^application\/problem\+json/);
        expect(response.body.status).toBe('error');
        expect(response.body.error.dependency).toEqual({ status: 'down' });
        expect(response.body.details.dependency).toEqual({ status: 'down' });
        expect(JSON.stringify(response.body)).not.toContain('sensitive readiness failure');
    });
});

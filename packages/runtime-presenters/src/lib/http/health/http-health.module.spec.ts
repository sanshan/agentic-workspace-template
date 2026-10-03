import type { ReadinessCheck } from '@agentic-workspace/runtime-health';
import { ShutdownSignal, type INestApplication } from '@nestjs/common';
import type { NestApplicationContext } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { HttpHealthModule } from '../../../http/health.js';

interface FakeReadinessCheck extends ReadinessCheck {
    readonly check: Mock<() => Promise<void>>;
}

describe('HttpHealthModule', () => {
    let app: INestApplication;
    let appClosed: boolean;
    let primaryCheck: FakeReadinessCheck;
    let secondaryCheck: FakeReadinessCheck;

    beforeEach(async () => {
        appClosed = false;
        primaryCheck = {
            name: 'primary',
            check: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
        };
        secondaryCheck = {
            name: 'secondary',
            check: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            imports: [
                HttpHealthModule.register({
                    readinessChecks: {
                        useFactory: () => [primaryCheck, secondaryCheck],
                    },
                }),
            ],
        }).compile();

        app = module.createNestApplication();
        app.setGlobalPrefix('service');
        await app.init();
    });

    afterEach(async () => {
        if (!appClosed) {
            await app.close();
        }
    });

    it('exposes liveness relative to the host prefix without invoking readiness checks', async () => {
        const response = await request(app.getHttpServer()).get('/service/health/live').expect(200);

        expect(response.body).toMatchObject({
            status: 'ok',
            info: {},
            error: {},
            details: {},
        });
        expect(primaryCheck.check).not.toHaveBeenCalled();
        expect(secondaryCheck.check).not.toHaveBeenCalled();
    });

    it('reports each supplied readiness check under its stable name', async () => {
        const response = await request(app.getHttpServer()).get('/service/health/ready').expect(200);

        expect(primaryCheck.check).toHaveBeenCalledOnce();
        expect(secondaryCheck.check).toHaveBeenCalledOnce();
        expect(response.body.status).toBe('ok');
        expect(response.body.info.primary).toEqual({ status: 'up' });
        expect(response.body.info.secondary).toEqual({ status: 'up' });
        expect(response.body.details.primary).toEqual({ status: 'up' });
        expect(response.body.details.secondary).toEqual({ status: 'up' });
    });

    it('maps readiness failures to down without leaking the underlying error', async () => {
        primaryCheck.check.mockRejectedValue(new Error('sensitive dependency failure'));

        const response = await request(app.getHttpServer()).get('/service/health/ready').expect(503);

        expect(response.body.status).toBe('error');
        expect(response.body.error.primary).toEqual({ status: 'down' });
        expect(response.body.details.primary).toEqual({ status: 'down' });
        expect(JSON.stringify(response.body)).not.toContain('sensitive dependency failure');
    });

    it('reports readiness as shutting down during the shared graceful shutdown delay', async () => {
        const closePromise = (app.close as NestApplicationContext['close'])(ShutdownSignal.SIGTERM);

        await new Promise((resolve) => setTimeout(resolve, 16));

        const response = await request(app.getHttpServer()).get('/service/health/ready').expect(503);

        expect(response.body.status).toBe('shutting_down');

        await closePromise;
        appClosed = true;
    });
});

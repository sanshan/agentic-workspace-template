import { tenantName, type TenantReference } from '@agentic-workspace/core';
import type { Actor } from '@event-driven-platform/actor';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { HTTP_REQUEST_IDENTITY_HEADERS } from './http-request-identity.headers.js';
import { httpRequestIdentityMiddleware } from './http-request-identity.middleware.js';

interface TestRequest {
    readonly headers: Record<string, string | string[] | undefined>;
    rawHeaders?: string[];
    actor?: Actor;
    tenant?: TenantReference;
}

function createRequest(): TestRequest {
    const headers: Record<string, string | string[] | undefined> = {
        [HTTP_REQUEST_IDENTITY_HEADERS.actorType]: 'user',
        [HTTP_REQUEST_IDENTITY_HEADERS.actorId]: 'user-1',
        [HTTP_REQUEST_IDENTITY_HEADERS.tenantId]: 'tenant-1',
    };
    const rawHeaders = Object.entries(headers).flatMap(([name, value]) => [
        name,
        value as string,
    ]);

    return {
        headers,
        rawHeaders,
    };
}

describe('httpRequestIdentityMiddleware', () => {
    it('passes trusted header data into typed request identity before continuing', () => {
        const request = createRequest();
        const next = vi.fn();

        httpRequestIdentityMiddleware(request, {}, next);

        expect(request.actor).toEqual({
            type: 'user',
            id: 'user-1',
            origin: {},
        });
        expect(request.tenant).toEqual({
            type: tenantName,
            id: 'tenant-1',
        });
        expect(next).toHaveBeenCalledOnce();
    });

    it.each(Object.values(HTTP_REQUEST_IDENTITY_HEADERS))(
        'rejects a request missing %s',
        (headerName) => {
            const request = createRequest();
            delete request.headers[headerName];
            delete request.rawHeaders;
            const next = vi.fn();

            expect(() => httpRequestIdentityMiddleware(request, {}, next)).toThrow(
                UnauthorizedException,
            );
            expect(next).not.toHaveBeenCalled();
        },
    );

    it('rejects blank or padded identity values', () => {
        const request = createRequest();
        request.headers[HTTP_REQUEST_IDENTITY_HEADERS.tenantId] = ' tenant-1 ';
        delete request.rawHeaders;
        const next = vi.fn();

        expect(() => httpRequestIdentityMiddleware(request, {}, next)).toThrow(
            UnauthorizedException,
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects repeated trusted identity headers', () => {
        const request = createRequest();
        request.rawHeaders?.push(
            HTTP_REQUEST_IDENTITY_HEADERS.actorId,
            'user-2',
        );
        const next = vi.fn();

        expect(() => httpRequestIdentityMiddleware(request, {}, next)).toThrow(
            UnauthorizedException,
        );
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects actor identity outside the EDP Actor contract without mutating the request', () => {
        const request = createRequest();
        request.headers[HTTP_REQUEST_IDENTITY_HEADERS.actorType] = 'administrator';
        delete request.rawHeaders;
        const next = vi.fn();

        expect(() => httpRequestIdentityMiddleware(request, {}, next)).toThrow(
            UnauthorizedException,
        );
        expect(request.actor).toBeUndefined();
        expect(request.tenant).toBeUndefined();
        expect(next).not.toHaveBeenCalled();
    });
});

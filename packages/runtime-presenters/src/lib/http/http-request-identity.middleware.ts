import { tenantName, type TenantId, type TenantReference } from '@agentic-workspace/core';
import {
    DefaultActorFactory,
    type Actor,
    type ActorType,
} from '@event-driven-platform/actor';
import { DefaultTenantReferenceFactory } from '@event-driven-platform/tenant-reference';
import { UnauthorizedException } from '@nestjs/common';

import { HTTP_REQUEST_IDENTITY_HEADERS } from './http-request-identity.headers.js';

interface MutableHttpIdentityRequest {
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    readonly rawHeaders?: readonly string[];
    actor?: Actor;
    tenant?: TenantReference;
}

const unauthorizedIdentityMessage = 'Missing or invalid trusted request identity.';
const actorFactory = new DefaultActorFactory();
const tenantReferenceFactory = new DefaultTenantReferenceFactory();

function countRawHeaderOccurrences(rawHeaders: readonly string[], name: string): number {
    let count = 0;

    for (let index = 0; index < rawHeaders.length; index += 2) {
        if (rawHeaders[index]?.toLowerCase() === name) {
            count += 1;
        }
    }

    return count;
}

function readRequiredIdentityHeader(request: MutableHttpIdentityRequest, name: string): string {
    if (
        request.rawHeaders !== undefined &&
        countRawHeaderOccurrences(request.rawHeaders, name) !== 1
    ) {
        throw new UnauthorizedException(unauthorizedIdentityMessage);
    }

    const value = request.headers[name];

    if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
        throw new UnauthorizedException(unauthorizedIdentityMessage);
    }

    return value;
}

export function httpRequestIdentityMiddleware(
    request: MutableHttpIdentityRequest,
    _response: unknown,
    next: () => void,
): void {
    const actorType = readRequiredIdentityHeader(
        request,
        HTTP_REQUEST_IDENTITY_HEADERS.actorType,
    );
    const actorId = readRequiredIdentityHeader(request, HTTP_REQUEST_IDENTITY_HEADERS.actorId);
    const tenantId = readRequiredIdentityHeader(request, HTTP_REQUEST_IDENTITY_HEADERS.tenantId);

    let actor: Actor;
    let tenant: TenantReference;

    try {
        actor = actorFactory.create({
            type: actorType as ActorType,
            id: actorId,
        });
        tenant = tenantReferenceFactory.create({
            type: tenantName,
            id: tenantId as TenantId,
        });
    } catch {
        throw new UnauthorizedException(unauthorizedIdentityMessage);
    }

    request.actor = actor;
    request.tenant = tenant;

    next();
}

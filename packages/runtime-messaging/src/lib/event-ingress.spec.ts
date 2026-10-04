import { ExecutionFailureError } from '@event-driven-platform/execution';
import { describe, expect, it, vi } from 'vitest';

import type { EventHandler } from './event-handler.js';
import { EventHandlerRegistry } from './event-handler-registry.js';
import { EventIngress } from './event-ingress.js';
import { createEventEnvelope } from './testing/event-envelope.fixture.js';

function createHandler(handle?: EventHandler['handle']): EventHandler {
    const defaultHandle: EventHandler['handle'] = vi.fn(async () => ({
        status: 'handled' as const,
        result: 'handled-result',
    }));

    return {
        identity: {
            eventName: 'test.event',
            schemaVersion: 1,
        },
        handle: handle ?? defaultHandle,
    };
}

async function captureThrown(promise: Promise<unknown>): Promise<unknown> {
    try {
        await promise;
        return new Error('Expected promise to reject.');
    } catch (error) {
        return error;
    }
}

describe('EventIngress', () => {
    it('passes the original valid envelope to the exact handler', async () => {
        const registry = new EventHandlerRegistry();
        const handler = createHandler();
        registry.register(handler);
        registry.seal();
        const ingress = new EventIngress(registry);
        const envelope = createEventEnvelope();

        await expect(ingress.dispatch(envelope)).resolves.toEqual({
            status: 'handled',
            result: 'handled-result',
        });
        expect(handler.handle).toHaveBeenCalledTimes(1);
        expect(handler.handle).toHaveBeenCalledWith(envelope);
    });

    it('returns invalid before resolution when envelope metadata is malformed', async () => {
        const registry = new EventHandlerRegistry();
        const handler = createHandler();
        registry.register(handler);
        registry.seal();
        const ingress = new EventIngress(registry);

        await expect(ingress.dispatch(createEventEnvelope({ eventName: 42 }))).resolves.toMatchObject({
            status: 'invalid',
            failure: {
                kind: 'event-validation',
            },
        });
        expect(handler.handle).not.toHaveBeenCalled();
    });

    it('returns an explicit unhandled outcome for an exact identity miss', async () => {
        const registry = new EventHandlerRegistry();
        const handler = createHandler();
        registry.register(handler);
        registry.seal();
        const ingress = new EventIngress(registry);

        await expect(
            ingress.dispatch(createEventEnvelope({ schemaVersion: 2 })),
        ).resolves.toEqual({
            status: 'unhandled',
            identity: {
                eventName: 'test.event',
                schemaVersion: 2,
            },
        });
        expect(handler.handle).not.toHaveBeenCalled();
    });

    it('does not dispatch before the registry is sealed', async () => {
        const registry = new EventHandlerRegistry();
        const handler = createHandler();
        registry.register(handler);
        const ingress = new EventIngress(registry);

        await expect(ingress.dispatch(createEventEnvelope())).rejects.toThrow(
            'Event handler registry is not sealed.',
        );
        expect(handler.handle).not.toHaveBeenCalled();
    });

    it.each([
        [
            'ExecutionFailureError',
            new ExecutionFailureError({
                code: 'test.failure',
                message: 'classified failure',
                retryable: true,
            }),
        ],
        ['ordinary Error', new Error('ordinary failure')],
        ['non-Error value', { kind: 'non-error-thrown-value' }],
    ])('preserves a handler-thrown %s unchanged', async (_label, thrown) => {
        const registry = new EventHandlerRegistry();
        const handler = createHandler(async () => {
            throw thrown;
        });
        registry.register(handler);
        registry.seal();
        const ingress = new EventIngress(registry);

        expect(await captureThrown(ingress.dispatch(createEventEnvelope()))).toBe(thrown);
    });
});

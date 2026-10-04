import { describe, expect, it, vi } from 'vitest';

import type { EventHandler } from './event-handler.js';
import { EventHandlerRegistry } from './event-handler-registry.js';

function createHandler(eventName: string, schemaVersion: number): EventHandler {
    return {
        identity: { eventName, schemaVersion },
        handle: vi.fn(async () => ({ status: 'handled' as const, result: undefined })),
    };
}

describe('EventHandlerRegistry', () => {
    it('resolves only an exact event name and schema version match after seal', () => {
        const registry = new EventHandlerRegistry();
        const handler = createHandler('test.event', 2);

        registry.register(handler);
        registry.seal();

        expect(registry.resolve({ eventName: 'test.event', schemaVersion: 2 })).toEqual({
            status: 'resolved',
            handler,
        });
        expect(registry.resolve({ eventName: 'test.event', schemaVersion: 1 })).toEqual({
            status: 'not-found',
        });
        expect(registry.resolve({ eventName: 'other.event', schemaVersion: 2 })).toEqual({
            status: 'not-found',
        });
    });

    it.each([
        ['first then second', false],
        ['second then first', true],
    ])('rejects duplicate identity regardless of registration order: %s', (_label, reverse) => {
        const registry = new EventHandlerRegistry();
        const first = createHandler('test.event', 1);
        const second = createHandler('test.event', 1);
        const initial = reverse ? second : first;
        const duplicate = reverse ? first : second;

        registry.register(initial);

        expect(() => registry.register(duplicate)).toThrow(
            'Duplicate Event handler registration for "test.event" schema version 1.',
        );
        expect(() => registry.seal()).toThrow(
            'Cannot seal Event handler registry after a failed registration.',
        );
    });

    it('rejects resolution before seal and registration after seal', () => {
        const registry = new EventHandlerRegistry();

        expect(() => registry.resolve({ eventName: 'test.event', schemaVersion: 1 })).toThrow(
            'Event handler registry is not sealed.',
        );

        registry.seal();

        expect(() => registry.register(createHandler('test.event', 1))).toThrow(
            'Event handler registry is sealed.',
        );
    });
});

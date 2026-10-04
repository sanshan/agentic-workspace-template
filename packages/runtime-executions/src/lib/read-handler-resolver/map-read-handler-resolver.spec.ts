import { describe, expect, it } from 'vitest';

import type { AnyRead } from '@event-driven-platform/read';
import type { ReadHandler } from '@event-driven-platform/read-handler';

import { MapReadHandlerResolver } from './map-read-handler-resolver.js';

const tenant = {
    type: 'test',
    id: 'test' as AnyRead['tenant']['id'],
} satisfies AnyRead['tenant'];

const createRead = (name: string): AnyRead => ({
    name,
    actor: {
        type: 'system',
        id: 'test',
        origin: {},
    },
    tenant,
    parameters: {},
});

const handler: ReadHandler<AnyRead> = {
    execute: async () => null,
};

describe('MapReadHandlerResolver', () => {
    it('resolves one registered handler as a singleton EDP handler set', () => {
        const resolver = new MapReadHandlerResolver([
            {
                readName: 'documents.get-document',
                handler,
            },
        ]);

        expect(resolver.resolve(createRead('documents.get-document'))).toEqual({
            status: 'resolved',
            handlers: [handler],
        });
    });

    it('rejects duplicate Read-name bindings', () => {
        expect(
            () =>
                new MapReadHandlerResolver([
                    {
                        readName: 'documents.get-document',
                        handler,
                    },
                    {
                        readName: 'documents.get-document',
                        handler,
                    },
                ]),
        ).toThrowError('Duplicate Read handler binding for "documents.get-document".');
    });

    it('returns the EDP not-found outcome when no handler is registered', () => {
        const resolver = new MapReadHandlerResolver([]);

        expect(resolver.resolve(createRead('documents.get-document'))).toEqual({
            status: 'not-found',
        });
    });
});

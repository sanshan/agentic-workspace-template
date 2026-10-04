import type { AnyOperation } from '@event-driven-platform/operation';
import type { OperationHandler } from '@event-driven-platform/operation-handler';
import { describe, expect, it } from 'vitest';

import { MapOperationHandlerResolver } from './map-operation-handler-resolver.js';

const handler: OperationHandler<AnyOperation> = {
    execute: () => Promise.reject(new Error('not executed by resolver tests')),
};

const operation = (name: string): AnyOperation => ({ name }) as AnyOperation;

describe('MapOperationHandlerResolver', () => {
    it('resolves a registered handler by Operation name', () => {
        const resolver = new MapOperationHandlerResolver([
            { operationName: 'documents.prepare-registration', handler },
        ]);

        expect(resolver.resolve(operation('documents.prepare-registration'))).toBe(handler);
    });

    it('rejects duplicate Operation names during construction', () => {
        expect(
            () =>
                new MapOperationHandlerResolver([
                    { operationName: 'documents.prepare-registration', handler },
                    { operationName: 'documents.prepare-registration', handler },
                ]),
        ).toThrow('Duplicate Operation handler binding for "documents.prepare-registration".');
    });

    it('rejects an Operation name without a binding', () => {
        const resolver = new MapOperationHandlerResolver([]);

        expect(() => resolver.resolve(operation('documents.missing'))).toThrow(
            'No Operation handler binding for "documents.missing".',
        );
    });
});

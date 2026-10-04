import type { ReaderObserver } from '@event-driven-platform/observability';
import { DefaultReader } from '@event-driven-platform/reader';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MapReadHandlerResolver } from '../read-handler-resolver/map-read-handler-resolver.js';
import { createServiceReader } from './create-service-reader.js';

const { captureDependencies } = vi.hoisted(() => ({
    captureDependencies: vi.fn(),
}));

vi.mock('@event-driven-platform/reader', () => ({
    DefaultReader: class {
        public constructor(dependencies: unknown) {
            captureDependencies(dependencies);
        }
    },
}));

describe('createServiceReader', () => {
    beforeEach(() => {
        captureDependencies.mockClear();
    });

    it('delegates the service resolver and observer to the published EDP DefaultReader', () => {
        const readHandlerResolver = new MapReadHandlerResolver([]);
        const observer = { observe: vi.fn() } satisfies ReaderObserver;

        const reader = createServiceReader({ readHandlerResolver, observer });

        expect(reader).toBeInstanceOf(DefaultReader);
        expect(captureDependencies).toHaveBeenCalledOnce();
        expect(captureDependencies).toHaveBeenCalledWith({
            readHandlerResolver,
            observer,
        });
    });
});

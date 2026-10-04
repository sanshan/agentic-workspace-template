import type { ReaderObserver } from '@event-driven-platform/observability';

import type { ReadHandlerResolver } from '../read-handler-resolver/read-handler-resolver.js';

export interface CreateServiceReaderOptions {
    readonly readHandlerResolver: ReadHandlerResolver;
    readonly observer?: ReaderObserver;
}

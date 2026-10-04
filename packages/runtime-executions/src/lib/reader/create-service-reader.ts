import { DefaultReader } from '@event-driven-platform/reader';

import type { CreateServiceReaderOptions } from './create-service-reader-options.js';
import type { Reader } from './reader.js';

export function createServiceReader(options: CreateServiceReaderOptions): Reader {
    return new DefaultReader({
        readHandlerResolver: options.readHandlerResolver,
        ...(options.observer ? { observer: options.observer } : {}),
    });
}

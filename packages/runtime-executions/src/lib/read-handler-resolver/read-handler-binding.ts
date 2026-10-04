import type { AnyRead } from '@event-driven-platform/read';
import type { ReadHandler } from '@event-driven-platform/read-handler';

export interface ReadHandlerBinding {
    readonly readName: string;
    readonly handler: ReadHandler<AnyRead>;
}

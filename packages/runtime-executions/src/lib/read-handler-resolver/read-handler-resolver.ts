import type { AnyRead } from '@event-driven-platform/read';
import type {
    ReadHandlerResolution,
    ReadHandlerResolver as EdpReadHandlerResolver,
} from '@event-driven-platform/read-handler-resolver';

export abstract class ReadHandlerResolver implements EdpReadHandlerResolver {
    public abstract resolve<TRead extends AnyRead>(read: TRead): ReadHandlerResolution<TRead>;
}

import type { AnyRead } from '@event-driven-platform/read';
import type { ReadHandler } from '@event-driven-platform/read-handler';
import type { ReadHandlerResolution } from '@event-driven-platform/read-handler-resolver';

import type { ReadHandlerBinding } from './read-handler-binding.js';
import { ReadHandlerResolver } from './read-handler-resolver.js';

export class MapReadHandlerResolver extends ReadHandlerResolver {
    private readonly handlersByReadName: ReadonlyMap<string, ReadHandler<AnyRead>>;

    public constructor(bindings: readonly ReadHandlerBinding[]) {
        super();

        const handlersByReadName = new Map<string, ReadHandler<AnyRead>>();

        for (const binding of bindings) {
            if (handlersByReadName.has(binding.readName)) {
                throw new Error(`Duplicate Read handler binding for "${binding.readName}".`);
            }

            handlersByReadName.set(binding.readName, binding.handler);
        }

        this.handlersByReadName = handlersByReadName;
    }

    public resolve<TRead extends AnyRead>(read: TRead): ReadHandlerResolution<TRead> {
        const handler = this.handlersByReadName.get(read.name);

        if (handler === undefined) {
            return { status: 'not-found' };
        }

        return {
            status: 'resolved',
            handlers: [handler as ReadHandler<TRead>],
        };
    }
}

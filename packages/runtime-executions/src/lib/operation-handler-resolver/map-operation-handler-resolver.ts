import type { AnyOperation } from '@event-driven-platform/operation';
import type { OperationHandler } from '@event-driven-platform/operation-handler';

import type { OperationHandlerBinding } from './operation-handler-binding.js';
import { OperationHandlerResolver } from './operation-handler-resolver.js';

export class MapOperationHandlerResolver extends OperationHandlerResolver {
    private readonly handlersByOperationName: ReadonlyMap<string, OperationHandler<AnyOperation>>;

    public constructor(bindings: readonly OperationHandlerBinding[]) {
        super();

        const handlersByOperationName = new Map<string, OperationHandler<AnyOperation>>();

        for (const binding of bindings) {
            if (handlersByOperationName.has(binding.operationName)) {
                throw new Error(
                    `Duplicate Operation handler binding for "${binding.operationName}".`,
                );
            }

            handlersByOperationName.set(binding.operationName, binding.handler);
        }

        this.handlersByOperationName = handlersByOperationName;
    }

    public resolve<TOperation extends AnyOperation>(
        operation: TOperation,
    ): OperationHandler<TOperation> {
        const handler = this.handlersByOperationName.get(operation.name);

        if (handler === undefined) {
            throw new Error(`No Operation handler binding for "${operation.name}".`);
        }

        return handler as OperationHandler<TOperation>;
    }
}

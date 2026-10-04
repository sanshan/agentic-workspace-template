import type { AnyOperation } from '@event-driven-platform/operation';
import type { OperationHandler } from '@event-driven-platform/operation-handler';
import type { OperationHandlerResolver as EdpOperationHandlerResolver } from '@event-driven-platform/operation-handler-resolver';

export abstract class OperationHandlerResolver implements EdpOperationHandlerResolver {
    public abstract resolve<TOperation extends AnyOperation>(
        operation: TOperation,
    ): OperationHandler<TOperation>;
}

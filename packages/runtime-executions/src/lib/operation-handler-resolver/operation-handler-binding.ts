import type { AnyOperation } from '@event-driven-platform/operation';
import type { OperationHandler } from '@event-driven-platform/operation-handler';

export interface OperationHandlerBinding {
    readonly operationName: string;
    readonly handler: OperationHandler<AnyOperation>;
}

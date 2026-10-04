import { DefaultExecutionIdFactory } from '@event-driven-platform/execution';
import { createUseCaseExecutor } from '@event-driven-platform/use-case-executor';

import type { CreateServiceUseCaseExecutorOptions } from './create-service-use-case-executor-options.js';
import type { UseCaseExecutor } from './use-case-executor.js';

export function createServiceUseCaseExecutor(
    options: CreateServiceUseCaseExecutorOptions,
): UseCaseExecutor {
    return createUseCaseExecutor({
        dependencies: {
            clock: options.clock,
            executionIdFactory: new DefaultExecutionIdFactory(),
            store: options.store,
            ...(options.observer ? { observer: options.observer } : {}),
        },
        runtime: {
            leaseOwnerId: options.leaseOwnerId,
        },
    });
}

import { DefaultEventIdFactory } from '@event-driven-platform/event';
import { DefaultExecutionIdFactory } from '@event-driven-platform/execution';
import { DefaultOperationEventEnvelopeFactory } from '@event-driven-platform/operation-event-envelope-factory';
import { DefaultOutboxRecordFactory } from '@event-driven-platform/outbox';
import { createRunner } from '@event-driven-platform/runner';

import type { CreateServiceRunnerOptions } from './create-service-runner-options.js';
import type { Runner } from './runner.js';

const RUNNER_LEASE_DURATION_MS = 30_000;

export function createServiceRunner(options: CreateServiceRunnerOptions): Runner {
    const executionIdFactory = new DefaultExecutionIdFactory();
    const eventIdFactory = new DefaultEventIdFactory();
    const operationEventEnvelopeFactory = new DefaultOperationEventEnvelopeFactory(
        options.clock,
        eventIdFactory,
    );
    const outboxRecordFactory = new DefaultOutboxRecordFactory(options.clock);

    return createRunner({
        dependencies: {
            clock: options.clock,
            executionIdFactory,
            executionLogStore: options.executionLogStore,
            operationHandlerResolver: options.operationHandlerResolver,
            executionTransaction: options.executionTransaction,
            operationEventEnvelopeFactory,
            outboxRecordFactory,
            outboxStore: options.outboxStore,
            ...(options.observer ? { observer: options.observer } : {}),
        },
        runtime: {
            leaseOwnerId: options.leaseOwnerId,
        },
        options: {
            leaseDurationMs: RUNNER_LEASE_DURATION_MS,
        },
    });
}

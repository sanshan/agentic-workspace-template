import type { Clock } from '@event-driven-platform/clock';
import type { ExecutionLeaseOwnerId } from '@event-driven-platform/execution';
import type { ExecutionTransaction } from '@event-driven-platform/execution-transaction';
import type { RunnerObserver } from '@event-driven-platform/observability';

import type { ExecutionLogStore } from '../execution-log/execution-log-store.js';
import type { OperationHandlerResolver } from '../operation-handler-resolver/operation-handler-resolver.js';
import type { OutboxStore } from '../outbox/outbox-store.js';

export interface CreateServiceRunnerOptions {
    readonly clock: Clock;
    readonly leaseOwnerId: ExecutionLeaseOwnerId;
    readonly operationHandlerResolver: OperationHandlerResolver;
    readonly executionTransaction: ExecutionTransaction;
    readonly executionLogStore: ExecutionLogStore;
    readonly outboxStore: OutboxStore;
    readonly observer?: RunnerObserver;
}

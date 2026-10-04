import { FixedClock } from '@event-driven-platform/clock';
import { DefaultExecutionIdFactory, type ExecutionLeaseOwnerId } from '@event-driven-platform/execution';
import type { ExecutionLogStore } from '@event-driven-platform/execution-log-store';
import type { ExecutionTransaction } from '@event-driven-platform/execution-transaction';
import type { RunnerObserver } from '@event-driven-platform/observability';
import { DefaultOperationEventEnvelopeFactory } from '@event-driven-platform/operation-event-envelope-factory';
import { DefaultOutboxRecordFactory } from '@event-driven-platform/outbox';
import type { OutboxStore } from '@event-driven-platform/outbox-store';
import { createRunner } from '@event-driven-platform/runner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MapOperationHandlerResolver } from '../operation-handler-resolver/map-operation-handler-resolver.js';
import { createServiceRunner } from './create-service-runner.js';

vi.mock('@event-driven-platform/runner', () => ({
    createRunner: vi.fn(() => ({
        execute: vi.fn(),
        executeDetailed: vi.fn(),
    })),
}));

describe('createServiceRunner', () => {
    beforeEach(() => {
        vi.mocked(createRunner).mockClear();
    });

    it('delegates the Agentic Workspace baseline composition to EDP createRunner', () => {
        const clock = new FixedClock('2026-08-24T09:00:00.000Z');
        const leaseOwnerId = 'service-process-1' as ExecutionLeaseOwnerId;
        const operationHandlerResolver = new MapOperationHandlerResolver([]);
        const executionTransaction = Object.create(null) as ExecutionTransaction;
        const executionLogStore = Object.create(null) as ExecutionLogStore;
        const outboxStore = Object.create(null) as OutboxStore;
        const observer = { observe: vi.fn() } satisfies RunnerObserver;

        const runner = createServiceRunner({
            clock,
            leaseOwnerId,
            operationHandlerResolver,
            executionTransaction,
            executionLogStore,
            outboxStore,
            observer,
        });

        expect(runner).toBeDefined();
        expect(createRunner).toHaveBeenCalledOnce();

        const configuration = vi.mocked(createRunner).mock.calls[0]?.[0];

        expect(configuration).toBeDefined();
        if (!configuration) {
            throw new Error('Expected createRunner configuration.');
        }

        expect(configuration.dependencies.clock).toBe(clock);
        expect(configuration.dependencies.executionIdFactory).toBeInstanceOf(
            DefaultExecutionIdFactory,
        );
        expect(configuration.dependencies.operationEventEnvelopeFactory).toBeInstanceOf(
            DefaultOperationEventEnvelopeFactory,
        );
        expect(configuration.dependencies.outboxRecordFactory).toBeInstanceOf(
            DefaultOutboxRecordFactory,
        );
        expect(configuration.dependencies.operationHandlerResolver).toBe(operationHandlerResolver);
        expect(configuration.dependencies.executionTransaction).toBe(executionTransaction);
        expect(configuration.dependencies.executionLogStore).toBe(executionLogStore);
        expect(configuration.dependencies.outboxStore).toBe(outboxStore);
        expect(configuration.dependencies.observer).toBe(observer);
        expect(configuration.runtime.leaseOwnerId).toBe(leaseOwnerId);
        expect(configuration.options.leaseDurationMs).toBe(30_000);
        expect(configuration.dependencies).not.toHaveProperty('guardEvaluator');
        expect(configuration.dependencies).not.toHaveProperty('rateLimiter');
        expect(configuration.dependencies).not.toHaveProperty('retryDelay');
        expect(configuration.dependencies).not.toHaveProperty('executionTimeout');
    });
});

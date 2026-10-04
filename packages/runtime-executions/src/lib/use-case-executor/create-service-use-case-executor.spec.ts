import { FixedClock } from '@event-driven-platform/clock';
import {
    DefaultExecutionIdFactory,
    type ExecutionLeaseOwnerId,
} from '@event-driven-platform/execution';
import type { UseCaseExecutorObserver } from '@event-driven-platform/observability';
import type { UseCaseExecutionStore } from '@event-driven-platform/use-case-execution-store';
import { createUseCaseExecutor } from '@event-driven-platform/use-case-executor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServiceUseCaseExecutor } from './create-service-use-case-executor.js';

vi.mock('@event-driven-platform/use-case-executor', () => ({
    createUseCaseExecutor: vi.fn(() => ({
        execute: vi.fn(),
    })),
}));

describe('createServiceUseCaseExecutor', () => {
    beforeEach(() => {
        vi.mocked(createUseCaseExecutor).mockClear();
    });

    it('delegates the Agentic Workspace baseline composition to EDP createUseCaseExecutor', () => {
        const clock = new FixedClock('2026-08-24T12:00:00.000Z');
        const leaseOwnerId = 'service-process-1' as ExecutionLeaseOwnerId;
        const store = Object.create(null) as UseCaseExecutionStore;
        const observer = { observe: vi.fn() } satisfies UseCaseExecutorObserver;

        const executor = createServiceUseCaseExecutor({
            clock,
            leaseOwnerId,
            store,
            observer,
        });

        expect(executor).toBeDefined();
        expect(createUseCaseExecutor).toHaveBeenCalledOnce();

        const configuration = vi.mocked(createUseCaseExecutor).mock.calls[0]?.[0];

        expect(configuration).toBeDefined();
        if (!configuration) {
            throw new Error('Expected createUseCaseExecutor configuration.');
        }

        expect(configuration.dependencies.clock).toBe(clock);
        expect(configuration.dependencies.executionIdFactory).toBeInstanceOf(
            DefaultExecutionIdFactory,
        );
        expect(configuration.dependencies.store).toBe(store);
        expect(configuration.dependencies.observer).toBe(observer);
        expect(configuration.runtime.leaseOwnerId).toBe(leaseOwnerId);
        expect(configuration).not.toHaveProperty('options');
    });
});

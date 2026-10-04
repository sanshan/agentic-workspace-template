import { EventHandlerRegistry, type EventIdentity } from '@agentic-workspace/runtime-messaging';
import type { UseCaseContext } from '@event-driven-platform/use-case';
import type {
    UseCaseExecutionRequest,
    UseCaseExecutor,
} from '@event-driven-platform/use-case-executor';
import { describe, expect, it } from 'vitest';

import type { EventSubscription } from '../event-subscription.js';
import { EventSubscriptionRegistrar } from './event-subscription-registrar.js';

class UnusedExecutor implements UseCaseExecutor {
    public async execute<TInput, TResult, TContext extends UseCaseContext = UseCaseContext>(
        _request: UseCaseExecutionRequest<TInput, TResult, TContext>,
    ): Promise<TResult> {
        throw new Error('Executor should not run during registration.');
    }
}

function createSubscription(identity: EventIdentity, intentSlot: string): EventSubscription {
    return {
        identity,
        intentSlot,
        createHandler: () => ({
            identity,
            handle: async () => ({ status: 'handled' as const, result: undefined }),
        }),
    };
}

describe('EventSubscriptionRegistrar', () => {
    it('registers handlers from separate subscription collections into one registry', () => {
        const registry = new EventHandlerRegistry();
        const registrar = new EventSubscriptionRegistrar(registry);
        const executor = new UnusedExecutor();
        const first = createSubscription(
            { eventName: 'fixture.first', schemaVersion: 1 },
            'first-flow',
        );
        const second = createSubscription(
            { eventName: 'fixture.second', schemaVersion: 2 },
            'second-flow',
        );

        registrar.register([first], executor);
        registrar.register([second], executor);
        registrar.onApplicationBootstrap();
        registry.seal();

        expect(registry.resolve(first.identity)).toMatchObject({ status: 'resolved' });
        expect(registry.resolve(second.identity)).toMatchObject({ status: 'resolved' });
    });

    it('rejects duplicate intent slots across separate registration calls and keeps startup failed', () => {
        const registry = new EventHandlerRegistry();
        const registrar = new EventSubscriptionRegistrar(registry);
        const executor = new UnusedExecutor();

        registrar.register(
            [
                createSubscription(
                    { eventName: 'fixture.first', schemaVersion: 1 },
                    'shared-flow',
                ),
            ],
            executor,
        );

        expect(() =>
            registrar.register(
                [
                    createSubscription(
                        { eventName: 'fixture.second', schemaVersion: 1 },
                        'shared-flow',
                    ),
                ],
                executor,
            ),
        ).toThrow('Duplicate event subscription intent slot "shared-flow".');
        expect(() => registrar.onApplicationBootstrap()).toThrow(
            'Cannot start event subscriptions after a failed registration.',
        );
    });
});

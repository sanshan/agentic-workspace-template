import { EventHandlerRegistry } from '@agentic-workspace/runtime-messaging';
import type { UseCaseExecutor } from '@event-driven-platform/use-case-executor';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';

import { createEventHandlers, type EventSubscription } from '../event-subscription.js';

@Injectable()
export class EventSubscriptionRegistrar implements OnApplicationBootstrap {
    private readonly intentSlots = new Set<string>();

    private registrationFailure: Error | undefined;

    public constructor(private readonly registry: EventHandlerRegistry) {}

    public register(
        subscriptions: readonly EventSubscription[],
        executor: UseCaseExecutor,
    ): void {
        if (this.registrationFailure !== undefined) {
            throw new Error('Event subscription registration has already failed.');
        }

        const pendingSlots = new Set<string>();

        for (const subscription of subscriptions) {
            if (
                this.intentSlots.has(subscription.intentSlot) ||
                pendingSlots.has(subscription.intentSlot)
            ) {
                const error = new Error(
                    `Duplicate event subscription intent slot "${subscription.intentSlot}".`,
                );
                this.registrationFailure = error;
                throw error;
            }

            pendingSlots.add(subscription.intentSlot);
        }

        const handlers = createEventHandlers(subscriptions, executor);

        for (const handler of handlers) {
            this.registry.register(handler);
        }

        for (const slot of pendingSlots) {
            this.intentSlots.add(slot);
        }
    }

    public onApplicationBootstrap(): void {
        if (this.registrationFailure !== undefined) {
            throw new Error('Cannot start event subscriptions after a failed registration.');
        }
    }
}

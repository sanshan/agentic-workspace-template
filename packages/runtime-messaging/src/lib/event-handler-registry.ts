import type { EventHandler } from './event-handler.js';
import type { EventIdentity } from './event-identity.js';

export type EventHandlerResolution =
    | {
          readonly status: 'resolved';
          readonly handler: EventHandler;
      }
    | {
          readonly status: 'not-found';
      };

export class EventHandlerRegistry {
    private readonly handlersByEventName = new Map<string, Map<number, EventHandler>>();

    private sealed = false;

    private registrationFailure: Error | undefined;

    public get isSealed(): boolean {
        return this.sealed;
    }

    public register(handler: EventHandler): void {
        if (this.sealed) {
            throw new Error('Event handler registry is sealed.');
        }

        const { eventName, schemaVersion } = handler.identity;
        let handlersByVersion = this.handlersByEventName.get(eventName);

        if (handlersByVersion === undefined) {
            handlersByVersion = new Map<number, EventHandler>();
            this.handlersByEventName.set(eventName, handlersByVersion);
        }

        if (handlersByVersion.has(schemaVersion)) {
            const error = new Error(
                `Duplicate Event handler registration for "${eventName}" schema version ${schemaVersion}.`,
            );
            this.registrationFailure ??= error;
            throw error;
        }

        handlersByVersion.set(schemaVersion, handler);
    }

    public seal(): void {
        if (this.registrationFailure !== undefined) {
            throw new Error('Cannot seal Event handler registry after a failed registration.');
        }

        this.sealed = true;
    }

    public resolve(identity: EventIdentity): EventHandlerResolution {
        if (!this.sealed) {
            throw new Error('Event handler registry is not sealed.');
        }

        const handler = this.handlersByEventName.get(identity.eventName)?.get(identity.schemaVersion);

        if (handler === undefined) {
            return { status: 'not-found' };
        }

        return {
            status: 'resolved',
            handler,
        };
    }
}

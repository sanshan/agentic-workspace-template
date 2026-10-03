import type { EventHandlerOutcome } from './event-handler.js';
import type { EventHandlerRegistry } from './event-handler-registry.js';
import type { EventIdentity } from './event-identity.js';
import { validateEventEnvelope } from './validate-event-envelope.js';

export type EventIngressOutcome =
    | EventHandlerOutcome
    | {
          readonly status: 'unhandled';
          readonly identity: EventIdentity;
      };

export class EventIngress {
    public constructor(private readonly registry: EventHandlerRegistry) {}

    public async dispatch(input: unknown): Promise<EventIngressOutcome> {
        if (!this.registry.isSealed) {
            throw new Error('Event handler registry is not sealed.');
        }

        const validation = validateEventEnvelope(input);

        if (validation.status === 'invalid') {
            return validation;
        }

        const envelope = validation.value;
        const identity: EventIdentity = {
            eventName: envelope.eventName,
            schemaVersion: envelope.schemaVersion,
        };
        const resolution = this.registry.resolve(identity);

        if (resolution.status === 'not-found') {
            return {
                status: 'unhandled',
                identity,
            };
        }

        return resolution.handler.handle(envelope);
    }
}

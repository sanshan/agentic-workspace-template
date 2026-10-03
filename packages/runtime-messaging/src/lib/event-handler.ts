import type { AnyEventEnvelope } from '@event-driven-platform/event';

import type { EventIdentity } from './event-identity.js';
import type { EventValidationFailure } from './event-validation.js';

export type EventHandlerOutcome =
    | {
          readonly status: 'handled';
          readonly result: unknown;
      }
    | {
          readonly status: 'invalid';
          readonly failure: EventValidationFailure;
      };

export interface EventHandler {
    readonly identity: EventIdentity;

    handle(envelope: AnyEventEnvelope): Promise<EventHandlerOutcome>;
}

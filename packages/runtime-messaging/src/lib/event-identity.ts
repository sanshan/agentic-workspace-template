import type { AnyEventEnvelope } from '@event-driven-platform/event';

export interface EventIdentity {
    readonly eventName: AnyEventEnvelope['eventName'];

    readonly schemaVersion: AnyEventEnvelope['schemaVersion'];
}

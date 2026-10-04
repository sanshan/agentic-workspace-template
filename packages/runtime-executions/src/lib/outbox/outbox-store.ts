import type { OutboxStore as EdpOutboxStore } from '@event-driven-platform/outbox-store';

export abstract class OutboxStore implements EdpOutboxStore {
    public abstract append: EdpOutboxStore['append'];
}

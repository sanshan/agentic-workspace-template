import type { DataSource } from 'typeorm';

import type { OutboxStore } from '../lib/outbox/outbox-store.js';

import { OutboxEntity } from '../lib/outbox/typeorm/outbox.entity.js';
import { CreateOutbox1787559600000 } from '../lib/outbox/typeorm/migrations/1787559600000-CreateOutbox.js';
import { TypeOrmOutboxStore } from '../lib/outbox/typeorm/typeorm-outbox-store.js';

export const OUTBOX_TYPEORM_ENTITIES = [OutboxEntity] as const;

export const OUTBOX_TYPEORM_MIGRATIONS = [CreateOutbox1787559600000] as const;

export function createOutboxStore(dataSource: DataSource): OutboxStore {
    return new TypeOrmOutboxStore(dataSource);
}

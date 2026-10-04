import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';

import type { ReadinessCheck } from '../readiness-check.js';
import type { DatabaseHealthProbeEntity } from './database-health-probe.entity.js';

export class TypeOrmDatabaseReadinessCheck implements ReadinessCheck {
    readonly name = 'database';

    constructor(private readonly repository: Repository<DatabaseHealthProbeEntity>) {}

    async check(): Promise<void> {
        const id = randomUUID();
        const marker = `database-health-check:${id}`;

        await this.repository.save({ id, marker });

        try {
            const persistedProbe = await this.repository.findOneBy({ id });

            if (!persistedProbe || persistedProbe.marker !== marker) {
                throw new Error('Database health probe validation failed');
            }
        } finally {
            await this.repository.delete({ id });
        }
    }
}

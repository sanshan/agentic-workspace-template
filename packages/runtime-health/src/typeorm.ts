import type { DataSource } from 'typeorm';

import type { ReadinessCheck } from './lib/readiness-check.js';
import { DatabaseHealthProbeEntity } from './lib/typeorm/database-health-probe.entity.js';
import { CreateDatabaseHealthProbes1787040000000 } from './lib/typeorm/migrations/1787040000000-CreateDatabaseHealthProbes.js';
import { TypeOrmDatabaseReadinessCheck } from './lib/typeorm/typeorm-database-readiness-check.js';

export const RUNTIME_HEALTH_TYPEORM_ENTITIES = [DatabaseHealthProbeEntity] as const;

export const RUNTIME_HEALTH_TYPEORM_MIGRATIONS = [
    CreateDatabaseHealthProbes1787040000000,
] as const;

export function createTypeOrmDatabaseReadinessCheck(dataSource: DataSource): ReadinessCheck {
    return new TypeOrmDatabaseReadinessCheck(dataSource.getRepository(DatabaseHealthProbeEntity));
}

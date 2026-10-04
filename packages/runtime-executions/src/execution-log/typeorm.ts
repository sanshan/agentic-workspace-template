import type { DataSource } from 'typeorm';

import type { ExecutionLogStore } from '../lib/execution-log/execution-log-store.js';

import { ExecutionAttemptEntity } from '../lib/execution-log/typeorm/execution-attempt.entity.js';
import { ExecutionLogEntity } from '../lib/execution-log/typeorm/execution-log.entity.js';
import { CreateExecutionLog1787553000000 } from '../lib/execution-log/typeorm/migrations/1787553000000-CreateExecutionLog.js';
import { TypeOrmExecutionLogStore } from '../lib/execution-log/typeorm/typeorm-execution-log-store.js';

export const EXECUTION_LOG_TYPEORM_ENTITIES = [
    ExecutionLogEntity,
    ExecutionAttemptEntity,
] as const;

export const EXECUTION_LOG_TYPEORM_MIGRATIONS = [CreateExecutionLog1787553000000] as const;

export function createExecutionLogStore(dataSource: DataSource): ExecutionLogStore {
    return new TypeOrmExecutionLogStore(dataSource);
}

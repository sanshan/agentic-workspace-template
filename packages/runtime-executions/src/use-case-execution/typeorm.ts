import type { DataSource } from 'typeorm';

import type { UseCaseExecutionStore } from '../lib/use-case-execution/use-case-execution-store.js';

import { CreateUseCaseExecution1787572800000 } from '../lib/use-case-execution/typeorm/migrations/1787572800000-CreateUseCaseExecution.js';
import { TypeOrmUseCaseExecutionStore } from '../lib/use-case-execution/typeorm/typeorm-use-case-execution-store.js';
import { UseCaseExecutionEntity } from '../lib/use-case-execution/typeorm/use-case-execution.entity.js';

export const USE_CASE_EXECUTION_TYPEORM_ENTITIES = [UseCaseExecutionEntity] as const;

export const USE_CASE_EXECUTION_TYPEORM_MIGRATIONS = [CreateUseCaseExecution1787572800000] as const;

export function createUseCaseExecutionStore(dataSource: DataSource): UseCaseExecutionStore {
    return new TypeOrmUseCaseExecutionStore(dataSource);
}

import { ExecutionTransactionOutcomes } from '@event-driven-platform/execution-transaction';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { createTransactionAwareDataSource } from './transaction-aware-data-source.js';
import { TypeOrmExecutionTransaction } from './typeorm-execution-transaction.js';
import { TypeOrmTransactionContext } from './typeorm-transaction-context.js';

class TestEntity {
    public id = '';
}

function createDataSource(): DataSource {
    return new DataSource({
        type: 'postgres',
        host: '127.0.0.1',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        database: 'agentic-workspace',
        entities: [TestEntity],
    });
}

function mockRepositoryResult(repository: Repository<TestEntity>, id: string): void {
    vi.spyOn(repository, 'findOneBy').mockImplementation(
        async function (this: Repository<TestEntity>) {
            return { id: this === repository ? id : 'unbound' };
        },
    );
}

describe('@agentic-workspace/runtime-executions/typeorm', () => {
    it('selects the transaction-bound repository at use time', async () => {
        const dataSource = createDataSource();
        const defaultRepository = dataSource.manager.getRepository(TestEntity);
        const transactionManager = dataSource.createEntityManager();
        const transactionRepository = transactionManager.getRepository(TestEntity);
        mockRepositoryResult(defaultRepository, 'default');
        mockRepositoryResult(transactionRepository, 'transaction');

        const transactionContext = new TypeOrmTransactionContext();
        const transactionAwareDataSource = createTransactionAwareDataSource(
            dataSource,
            transactionContext,
        );
        const repository = transactionAwareDataSource.getRepository(TestEntity);

        await expect(repository.findOneBy({ id: 'document-1' })).resolves.toEqual({
            id: 'default',
        });

        await transactionContext.run(transactionManager, async () => {
            await expect(repository.findOneBy({ id: 'document-1' })).resolves.toEqual({
                id: 'transaction',
            });
        });
    });

    it('commits through QueryRunner while exposing its manager in the transaction context', async () => {
        const dataSource = createDataSource();
        const queryRunner = dataSource.createQueryRunner();
        vi.spyOn(queryRunner, 'connect').mockResolvedValue(undefined);
        vi.spyOn(queryRunner, 'startTransaction').mockResolvedValue(undefined);
        vi.spyOn(queryRunner, 'commitTransaction').mockResolvedValue(undefined);
        vi.spyOn(queryRunner, 'rollbackTransaction').mockResolvedValue(undefined);
        vi.spyOn(queryRunner, 'release').mockResolvedValue(undefined);
        vi.spyOn(dataSource, 'createQueryRunner').mockReturnValue(queryRunner);

        const transactionContext = new TypeOrmTransactionContext();
        const transaction = new TypeOrmExecutionTransaction(dataSource, transactionContext);

        await transaction.execute(async () => {
            expect(transactionContext.getManager()).toBe(queryRunner.manager);

            return ExecutionTransactionOutcomes.commit(undefined);
        });

        expect(queryRunner.commitTransaction).toHaveBeenCalledOnce();
        expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
        expect(queryRunner.release).toHaveBeenCalledOnce();
    });

    it('maps an EDP rollback outcome to QueryRunner rollback', async () => {
        const dataSource = createDataSource();
        const queryRunner = dataSource.createQueryRunner();
        vi.spyOn(queryRunner, 'connect').mockResolvedValue(undefined);
        vi.spyOn(queryRunner, 'startTransaction').mockResolvedValue(undefined);
        vi.spyOn(queryRunner, 'commitTransaction').mockResolvedValue(undefined);
        vi.spyOn(queryRunner, 'rollbackTransaction').mockResolvedValue(undefined);
        vi.spyOn(queryRunner, 'release').mockResolvedValue(undefined);
        vi.spyOn(dataSource, 'createQueryRunner').mockReturnValue(queryRunner);

        const transaction = new TypeOrmExecutionTransaction(
            dataSource,
            new TypeOrmTransactionContext(),
        );

        await transaction.execute(async () => ExecutionTransactionOutcomes.rollback(undefined));

        expect(queryRunner.rollbackTransaction).toHaveBeenCalledOnce();
        expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
        expect(queryRunner.release).toHaveBeenCalledOnce();
    });
});

import {
    isCommitExecutionTransactionOutcome,
    type ExecutionTransaction,
    type ExecutionTransactionWork,
} from '@event-driven-platform/execution-transaction';
import type { DataSource } from 'typeorm';

import type { TypeOrmTransactionContext } from './typeorm-transaction-context.js';

export class TypeOrmExecutionTransaction implements ExecutionTransaction {
    public constructor(
        private readonly dataSource: DataSource,
        private readonly transactionContext: TypeOrmTransactionContext,
    ) {}

    public async execute<TResult>(work: ExecutionTransactionWork<TResult>): Promise<TResult> {
        const queryRunner = this.dataSource.createQueryRunner();

        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            const outcome = await this.transactionContext.run(queryRunner.manager, work);

            if (isCommitExecutionTransactionOutcome(outcome)) {
                await queryRunner.commitTransaction();
            } else {
                await queryRunner.rollbackTransaction();
            }

            return outcome.result;
        } catch (error: unknown) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }

            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}

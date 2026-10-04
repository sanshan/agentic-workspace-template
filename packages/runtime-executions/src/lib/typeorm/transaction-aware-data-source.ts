import type {
    DataSource,
    EntityTarget,
    ObjectLiteral,
    Repository,
} from 'typeorm';

import type { TypeOrmTransactionContext } from './typeorm-transaction-context.js';

function createTransactionAwareRepository<TEntity extends ObjectLiteral>(
    dataSource: DataSource,
    transactionContext: TypeOrmTransactionContext,
    entity: EntityTarget<TEntity>,
): Repository<TEntity> {
    const defaultRepository = dataSource.manager.getRepository(entity);

    return new Proxy(defaultRepository, {
        get(_target, property) {
            const manager = transactionContext.getManager() ?? dataSource.manager;
            const repository = manager.getRepository(entity);
            const value = Reflect.get(repository, property, repository);

            return typeof value === 'function' ? value.bind(repository) : value;
        },
    });
}

export function createTransactionAwareDataSource(
    dataSource: DataSource,
    transactionContext: TypeOrmTransactionContext,
): DataSource {
    return new Proxy(dataSource, {
        get(target, property) {
            if (property === 'getRepository') {
                return <TEntity extends ObjectLiteral>(
                    entity: EntityTarget<TEntity>,
                ): Repository<TEntity> =>
                    createTransactionAwareRepository(dataSource, transactionContext, entity);
            }

            const value = Reflect.get(target, property, target);

            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}

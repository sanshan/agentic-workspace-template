import { AsyncLocalStorage } from 'node:async_hooks';

import type { EntityManager } from 'typeorm';

export class TypeOrmTransactionContext {
    private readonly storage = new AsyncLocalStorage<EntityManager>();

    public run<TResult>(manager: EntityManager, work: () => TResult): TResult {
        return this.storage.run(manager, work);
    }

    public getManager(): EntityManager | undefined {
        return this.storage.getStore();
    }
}

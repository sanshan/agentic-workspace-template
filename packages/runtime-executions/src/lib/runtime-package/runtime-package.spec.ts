import type { EntityTarget, MigrationInterface } from 'typeorm';

import { collectRuntimePackageTypeOrmSchema, defineRuntimePackage } from './runtime-package.js';

class FirstEntity {}
class SecondEntity {}

class FirstMigration implements MigrationInterface {
    public up(): Promise<void> {
        return Promise.resolve();
    }

    public down(): Promise<void> {
        return Promise.resolve();
    }
}

class SecondMigration implements MigrationInterface {
    public up(): Promise<void> {
        return Promise.resolve();
    }

    public down(): Promise<void> {
        return Promise.resolve();
    }
}

describe('runtime package TypeORM schema', () => {
    it('collects schema contributions from the hosted package list in registration order', () => {
        const first = defineRuntimePackage({
            typeorm: {
                entities: [FirstEntity] satisfies readonly EntityTarget<unknown>[],
                migrations: [FirstMigration],
            },
        });
        const withoutTypeOrm = defineRuntimePackage({});
        const second = defineRuntimePackage({
            typeorm: {
                entities: [SecondEntity] satisfies readonly EntityTarget<unknown>[],
                migrations: [SecondMigration],
            },
        });

        expect(collectRuntimePackageTypeOrmSchema([first, withoutTypeOrm, second])).toEqual({
            entities: [FirstEntity, SecondEntity],
            migrations: [FirstMigration, SecondMigration],
        });
    });
});

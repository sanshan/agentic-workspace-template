import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { OperationHandlerResolver } from '../operation-handler-resolver/operation-handler-resolver.js';
import { ReadHandlerResolver } from '../read-handler-resolver/read-handler-resolver.js';
import { Reader } from '../reader/reader.js';
import { defineRuntimePackage } from '../runtime-package/runtime-package.js';
import { Runner } from '../runner/runner.js';
import { UseCaseExecutor } from '../use-case-executor/use-case-executor.js';
import { RuntimeExecutionsModule } from './runtime-executions.module.js';

const OPERATION_BINDINGS = Symbol('TEST_OPERATION_BINDINGS');
const READ_BINDINGS = Symbol('TEST_READ_BINDINGS');

@Entity({ name: 'runtime_executions_test_entity' })
class TestEntity {
    @PrimaryGeneratedColumn()
    public id!: number;
}

abstract class TestPersistence {
    public abstract readonly dataSource: DataSource;
}

class TestPersistenceAdapter extends TestPersistence {
    public constructor(public readonly dataSource: DataSource) {
        super();
    }
}

const runtimePackage = defineRuntimePackage({
    execution: {
        providers: [
            {
                provide: OPERATION_BINDINGS,
                inject: [],
                useFactory: () => [],
            },
            {
                provide: READ_BINDINGS,
                inject: [],
                useFactory: () => [],
            },
        ],
        operationBindingContainers: [OPERATION_BINDINGS],
        readBindingContainers: [READ_BINDINGS],
    },
    typeorm: {
        entities: [TestEntity],
        persistence: [
            {
                provide: TestPersistence,
                create: (dataSource: DataSource) => new TestPersistenceAdapter(dataSource),
            },
        ],
    },
});

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env['DB_HOST'] ?? '127.0.0.1',
            port: Number(process.env['DB_PORT'] ?? '5432'),
            username: process.env['DB_USERNAME'] ?? 'postgres',
            password: process.env['DB_PASSWORD'] ?? 'postgres',
            database: process.env['DB_NAME'] ?? 'agentic-workspace',
            autoLoadEntities: true,
            synchronize: false,
        }),
        RuntimeExecutionsModule.register([runtimePackage]),
    ],
})
class TestHostModule {}

describe('RuntimeExecutionsModule', () => {
    it('composes the standard runtime graph from package manifests', async () => {
        const moduleRef = await Test.createTestingModule({ imports: [TestHostModule] }).compile();
        await moduleRef.init();

        const realDataSource = moduleRef.get(DataSource);
        const persistence = moduleRef.get(TestPersistence);

        expect(moduleRef.get(Runner)).toBeDefined();
        expect(moduleRef.get(Reader)).toBeDefined();
        expect(moduleRef.get(UseCaseExecutor)).toBeDefined();
        expect(moduleRef.get(OperationHandlerResolver)).toBeDefined();
        expect(moduleRef.get(ReadHandlerResolver)).toBeDefined();
        expect(persistence.dataSource).not.toBe(realDataSource);
        expect(realDataSource.isInitialized).toBe(true);

        await moduleRef.close();
        expect(realDataSource.isInitialized).toBe(false);
    });
});

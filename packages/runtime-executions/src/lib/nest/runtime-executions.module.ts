import { createEdpOpenTelemetryObservers } from '@agentic-workspace/runtime-observability';
import { SystemClock } from '@event-driven-platform/clock';
import { Module, type DynamicModule, type FactoryProvider, type Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { createExecutionLogStore, EXECUTION_LOG_TYPEORM_ENTITIES } from '../../execution-log/typeorm.js';
import { createOutboxStore, OUTBOX_TYPEORM_ENTITIES } from '../../outbox/typeorm.js';
import { createServiceReader } from '../../reader.js';
import { createServiceRunner } from '../../runner.js';
import {
    createTransactionAwareDataSource,
    TypeOrmExecutionTransaction,
    TypeOrmTransactionContext,
} from '../../typeorm.js';
import {
    createUseCaseExecutionStore,
    USE_CASE_EXECUTION_TYPEORM_ENTITIES,
} from '../../use-case-execution/typeorm.js';
import { createServiceUseCaseExecutor } from '../../use-case-executor.js';
import { ExecutionLogStore } from '../execution-log/execution-log-store.js';
import { MapOperationHandlerResolver } from '../operation-handler-resolver/map-operation-handler-resolver.js';
import type { OperationHandlerBinding } from '../operation-handler-resolver/operation-handler-binding.js';
import { OperationHandlerResolver } from '../operation-handler-resolver/operation-handler-resolver.js';
import { OutboxStore } from '../outbox/outbox-store.js';
import { MapReadHandlerResolver } from '../read-handler-resolver/map-read-handler-resolver.js';
import type { ReadHandlerBinding } from '../read-handler-resolver/read-handler-binding.js';
import { ReadHandlerResolver } from '../read-handler-resolver/read-handler-resolver.js';
import { Reader } from '../reader/reader.js';
import type {
    RuntimeFactoryProvider,
    RuntimePackageManifest,
    RuntimeTypeOrmPersistenceContribution,
} from '../runtime-package/runtime-package.js';
import { collectRuntimePackageTypeOrmSchema } from '../runtime-package/runtime-package.js';
import { Runner } from '../runner/runner.js';
import { UseCaseExecutionStore } from '../use-case-execution/use-case-execution-store.js';
import { UseCaseExecutor } from '../use-case-executor/use-case-executor.js';
import { RuntimeProcess } from './runtime-process.js';

function toNestFactoryProvider(provider: RuntimeFactoryProvider): FactoryProvider {
    return {
        provide: provider.provide as FactoryProvider['provide'],
        inject: [...provider.inject] as FactoryProvider['inject'],
        useFactory: provider.useFactory as FactoryProvider['useFactory'],
    };
}

function createPersistenceProvider(
    contribution: RuntimeTypeOrmPersistenceContribution,
): FactoryProvider {
    return {
        provide: contribution.provide as FactoryProvider['provide'],
        inject: [DataSource, TypeOrmTransactionContext],
        useFactory: (dataSource: DataSource, context: TypeOrmTransactionContext) =>
            contribution.create(createTransactionAwareDataSource(dataSource, context)),
    };
}

@Module({})
export class RuntimeExecutionsModule {
    public static register(packages: readonly RuntimePackageManifest[]): DynamicModule {
        const executionProviders = packages.flatMap((runtimePackage) =>
            (runtimePackage.execution?.providers ?? []).map(toNestFactoryProvider),
        );
        const persistenceProviders = packages.flatMap((runtimePackage) =>
            (runtimePackage.typeorm?.persistence ?? []).map(createPersistenceProvider),
        );
        const operationBindingContainers = packages.flatMap(
            (runtimePackage) => runtimePackage.execution?.operationBindingContainers ?? [],
        );
        const readBindingContainers = packages.flatMap(
            (runtimePackage) => runtimePackage.execution?.readBindingContainers ?? [],
        );
        const schema = collectRuntimePackageTypeOrmSchema(packages);
        const observers = createEdpOpenTelemetryObservers();

        const providers: Provider[] = [
            ...executionProviders,
            ...persistenceProviders,
            TypeOrmTransactionContext,
            {
                provide: TypeOrmExecutionTransaction,
                inject: [DataSource, TypeOrmTransactionContext],
                useFactory: (dataSource: DataSource, context: TypeOrmTransactionContext) =>
                    new TypeOrmExecutionTransaction(dataSource, context),
            },
            {
                provide: ExecutionLogStore,
                inject: [DataSource, TypeOrmTransactionContext],
                useFactory: (dataSource: DataSource, context: TypeOrmTransactionContext) =>
                    createExecutionLogStore(createTransactionAwareDataSource(dataSource, context)),
            },
            {
                provide: OutboxStore,
                inject: [DataSource, TypeOrmTransactionContext],
                useFactory: (dataSource: DataSource, context: TypeOrmTransactionContext) =>
                    createOutboxStore(createTransactionAwareDataSource(dataSource, context)),
            },
            {
                provide: UseCaseExecutionStore,
                inject: [DataSource],
                useFactory: createUseCaseExecutionStore,
            },
            {
                provide: OperationHandlerResolver,
                inject: [...operationBindingContainers] as FactoryProvider['inject'],
                useFactory: (...containers: readonly OperationHandlerBinding[][]) =>
                    new MapOperationHandlerResolver(containers.flat()),
            },
            {
                provide: ReadHandlerResolver,
                inject: [...readBindingContainers] as FactoryProvider['inject'],
                useFactory: (...containers: readonly ReadHandlerBinding[][]) =>
                    new MapReadHandlerResolver(containers.flat()),
            },
            SystemClock,
            RuntimeProcess,
            {
                provide: Runner,
                inject: [
                    SystemClock,
                    RuntimeProcess,
                    OperationHandlerResolver,
                    TypeOrmExecutionTransaction,
                    ExecutionLogStore,
                    OutboxStore,
                ],
                useFactory: (
                    clock: SystemClock,
                    process: RuntimeProcess,
                    operationHandlerResolver: OperationHandlerResolver,
                    executionTransaction: TypeOrmExecutionTransaction,
                    executionLogStore: ExecutionLogStore,
                    outboxStore: OutboxStore,
                ) =>
                    createServiceRunner({
                        clock,
                        leaseOwnerId: process.leaseOwnerId,
                        operationHandlerResolver,
                        executionTransaction,
                        executionLogStore,
                        outboxStore,
                        observer: observers.runner,
                    }),
            },
            {
                provide: Reader,
                inject: [ReadHandlerResolver],
                useFactory: (readHandlerResolver: ReadHandlerResolver) =>
                    createServiceReader({
                        readHandlerResolver,
                        observer: observers.reader,
                    }),
            },
            {
                provide: UseCaseExecutor,
                inject: [SystemClock, RuntimeProcess, UseCaseExecutionStore],
                useFactory: (
                    clock: SystemClock,
                    process: RuntimeProcess,
                    store: UseCaseExecutionStore,
                ) =>
                    createServiceUseCaseExecutor({
                        clock,
                        leaseOwnerId: process.leaseOwnerId,
                        store,
                        observer: observers.useCaseExecutor,
                    }),
            },
        ];

        return {
            module: RuntimeExecutionsModule,
            imports: [
                TypeOrmModule.forFeature([
                    ...schema.entities,
                    ...EXECUTION_LOG_TYPEORM_ENTITIES,
                    ...OUTBOX_TYPEORM_ENTITIES,
                    ...USE_CASE_EXECUTION_TYPEORM_ENTITIES,
                ]),
            ],
            providers,
            exports: [Runner, Reader, UseCaseExecutor],
        };
    }
}

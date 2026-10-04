import type { DataSource, EntitySchema, MigrationInterface } from 'typeorm';

export interface RuntimeFactoryProvider {
    readonly provide: unknown;
    readonly inject: readonly unknown[];
    readonly useFactory: (...dependencies: never[]) => unknown;
}

export interface RuntimeExecutionContribution {
    readonly providers: readonly RuntimeFactoryProvider[];
    readonly operationBindingContainers?: readonly unknown[];
    readonly readBindingContainers?: readonly unknown[];
}

export interface RuntimeTypeOrmPersistenceContribution {
    readonly provide: unknown;
    readonly create: (dataSource: DataSource) => unknown;
}

export type RuntimeTypeOrmEntity = EntitySchema<unknown> | (new (...args: never[]) => object);

export interface RuntimeTypeOrmContribution {
    readonly entities?: readonly RuntimeTypeOrmEntity[];
    readonly migrations?: readonly (new () => MigrationInterface)[];
    readonly persistence?: readonly RuntimeTypeOrmPersistenceContribution[];
}

export interface RuntimePackageManifest {
    readonly execution?: RuntimeExecutionContribution;
    readonly typeorm?: RuntimeTypeOrmContribution;
}

export function defineRuntimePackage<const TPackage extends RuntimePackageManifest>(
    runtimePackage: TPackage,
): TPackage {
    return runtimePackage;
}

export interface RuntimePackageTypeOrmSchema {
    readonly entities: readonly RuntimeTypeOrmEntity[];
    readonly migrations: readonly (new () => MigrationInterface)[];
}

export function collectRuntimePackageTypeOrmSchema(
    packages: readonly RuntimePackageManifest[],
): RuntimePackageTypeOrmSchema {
    return {
        entities: packages.flatMap((runtimePackage) => runtimePackage.typeorm?.entities ?? []),
        migrations: packages.flatMap((runtimePackage) => runtimePackage.typeorm?.migrations ?? []),
    };
}

import { DataSource } from 'typeorm';

import {
    createTypeOrmDatabaseReadinessCheck,
    RUNTIME_HEALTH_TYPEORM_ENTITIES,
    RUNTIME_HEALTH_TYPEORM_MIGRATIONS,
} from '../../typeorm.js';

const migrationsTableName = 'runtime_health_test_migrations';
const testDatabaseName = `agentic-workspace_runtime_health_${process.pid}`;
const DatabaseHealthProbeEntity = RUNTIME_HEALTH_TYPEORM_ENTITIES[0];
const DatabaseHealthMigration = RUNTIME_HEALTH_TYPEORM_MIGRATIONS[0];

const connection = {
    host: process.env['DB_HOST'] ?? '127.0.0.1',
    port: Number(process.env['DB_PORT'] ?? '5432'),
    username: process.env['DB_USERNAME'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? 'postgres',
};

function createAdminDataSource(): DataSource {
    return new DataSource({
        type: 'postgres',
        ...connection,
        database: 'postgres',
    });
}

function createDataSource(): DataSource {
    return new DataSource({
        type: 'postgres',
        ...connection,
        database: testDatabaseName,
        entities: [...RUNTIME_HEALTH_TYPEORM_ENTITIES],
        migrations: [...RUNTIME_HEALTH_TYPEORM_MIGRATIONS],
        migrationsTableName,
        synchronize: false,
    });
}

async function resetTestSchema(dataSource: DataSource): Promise<void> {
    await dataSource.query('DROP TABLE IF EXISTS "database_health_probes"');
    await dataSource.query(`DROP TABLE IF EXISTS "${migrationsTableName}"`);
}

describe('TypeORM database readiness', () => {
    let adminDataSource: DataSource;
    let dataSource: DataSource;

    beforeAll(async () => {
        adminDataSource = await createAdminDataSource().initialize();
        await adminDataSource.query(`DROP DATABASE IF EXISTS "${testDatabaseName}"`);
        await adminDataSource.query(`CREATE DATABASE "${testDatabaseName}"`);
    });

    afterAll(async () => {
        await adminDataSource.query(`DROP DATABASE IF EXISTS "${testDatabaseName}"`);
        await adminDataSource.destroy();
    });

    beforeEach(async () => {
        dataSource = await createDataSource().initialize();
        await resetTestSchema(dataSource);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await resetTestSchema(dataSource);
        await dataSource.destroy();
    });

    it('applies the shared migration and completes a write-read-validate-cleanup probe', async () => {
        const appliedMigrations = await dataSource.runMigrations();
        const check = createTypeOrmDatabaseReadinessCheck(dataSource);

        expect(appliedMigrations).toHaveLength(1);
        expect(appliedMigrations[0]?.name).toBe('CreateDatabaseHealthProbes1787040000000');
        expect(check.name).toBe('database');

        await check.check();

        expect(await dataSource.getRepository(DatabaseHealthProbeEntity).count()).toBe(0);
    });

    it('cleans the written probe when persisted marker validation fails', async () => {
        const migration = new DatabaseHealthMigration();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await migration.up(queryRunner);
        await queryRunner.release();

        const repository = dataSource.getRepository(DatabaseHealthProbeEntity);
        vi.spyOn(repository, 'findOneBy').mockResolvedValue({
            id: '00000000-0000-4000-8000-000000000000',
            marker: 'unexpected-marker',
        });

        const check = createTypeOrmDatabaseReadinessCheck(dataSource);

        await expect(check.check()).rejects.toThrow('Database health probe validation failed');
        expect(await repository.count()).toBe(0);
    });

    it('does not rerun the migration when its historical API migration name is already recorded', async () => {
        const migration = new DatabaseHealthMigration();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await migration.up(queryRunner);
        await queryRunner.query(`
            CREATE TABLE "${migrationsTableName}" (
                "id" SERIAL NOT NULL,
                "timestamp" bigint NOT NULL,
                "name" character varying NOT NULL,
                CONSTRAINT "PK_RUNTIME_HEALTH_TEST_MIGRATIONS" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `INSERT INTO "${migrationsTableName}" ("timestamp", "name") VALUES ($1, $2)`,
            [1787040000000, 'CreateDatabaseHealthProbes1787040000000'],
        );
        await queryRunner.release();

        await expect(dataSource.runMigrations()).resolves.toEqual([]);
    });
});

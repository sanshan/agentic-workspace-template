import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDatabaseHealthProbes1787040000000 implements MigrationInterface {
    name = 'CreateDatabaseHealthProbes1787040000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "database_health_probes" (
                "id" uuid NOT NULL,
                "marker" character varying(128) NOT NULL,
                CONSTRAINT "PK_DATABASE_HEALTH_PROBES" PRIMARY KEY ("id")
            )
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "database_health_probes"');
    }
}

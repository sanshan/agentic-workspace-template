import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutbox1787559600000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "outbox" (
                "id" uuid NOT NULL,
                "event_name" varchar NOT NULL,
                "schema_version" integer NOT NULL,
                "occurred_at" timestamptz NOT NULL,
                "intent_id" varchar NOT NULL,
                "correlation_id" varchar NOT NULL,
                "operation_name" varchar NOT NULL,
                "tenant_type" varchar NOT NULL,
                "tenant_id" varchar NOT NULL,
                "aggregate_type" varchar NOT NULL,
                "aggregate_id" varchar NOT NULL,
                "actor_type" varchar NOT NULL,
                "actor_id" varchar NOT NULL,
                "envelope" jsonb NOT NULL,
                "created_at" timestamptz NOT NULL,
                CONSTRAINT "pk_outbox" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_outbox_intent_id"
            ON "outbox" ("intent_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_outbox_correlation_id"
            ON "outbox" ("correlation_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_outbox_event_occurred_at"
            ON "outbox" ("event_name", "occurred_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_outbox_operation_occurred_at"
            ON "outbox" ("operation_name", "occurred_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_outbox_tenant_occurred_at"
            ON "outbox" ("tenant_type", "tenant_id", "occurred_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_outbox_aggregate_occurred_at"
            ON "outbox" ("aggregate_type", "aggregate_id", "occurred_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "outbox"');
    }
}

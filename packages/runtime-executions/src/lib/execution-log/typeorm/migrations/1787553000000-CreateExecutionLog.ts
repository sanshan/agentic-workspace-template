import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExecutionLog1787553000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "execution_log" (
                "execution_id" uuid NOT NULL,
                "intent_id" varchar NOT NULL,
                "operation_name" varchar NOT NULL,
                "operation_schema_version" integer NOT NULL,
                "tenant_type" varchar NOT NULL,
                "tenant_id" varchar NOT NULL,
                "aggregate_type" varchar NOT NULL,
                "aggregate_id" varchar NOT NULL,
                "actor_type" varchar NOT NULL,
                "actor_id" varchar NOT NULL,
                "operation" jsonb NOT NULL,
                "status" varchar NOT NULL,
                "attempt_count" integer NOT NULL,
                "result" jsonb,
                "created_at" timestamptz NOT NULL,
                "finished_at" timestamptz,
                CONSTRAINT "pk_execution_log" PRIMARY KEY ("execution_id"),
                CONSTRAINT "uq_execution_log_intent_id" UNIQUE ("intent_id"),
                CONSTRAINT "ck_execution_log_status" CHECK (
                    "status" IN ('in-progress', 'completed', 'failed', 'timed-out')
                ),
                CONSTRAINT "ck_execution_log_attempt_count" CHECK ("attempt_count" >= 1),
                CONSTRAINT "ck_execution_log_state" CHECK (
                    (
                        "status" = 'in-progress'
                        AND "result" IS NULL
                        AND "finished_at" IS NULL
                    ) OR (
                        "status" = 'completed'
                        AND "result" IS NOT NULL
                        AND "finished_at" IS NOT NULL
                    ) OR (
                        "status" IN ('failed', 'timed-out')
                        AND "result" IS NULL
                        AND "finished_at" IS NOT NULL
                    )
                )
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_execution_log_operation_created_at"
            ON "execution_log" ("operation_name", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_execution_log_tenant_created_at"
            ON "execution_log" ("tenant_type", "tenant_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_execution_log_aggregate_created_at"
            ON "execution_log" ("aggregate_type", "aggregate_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_execution_log_actor_created_at"
            ON "execution_log" ("actor_type", "actor_id", "created_at")
        `);

        await queryRunner.query(`
            CREATE TABLE "execution_attempt" (
                "attempt_id" uuid NOT NULL,
                "execution_id" uuid NOT NULL,
                "attempt_number" integer NOT NULL,
                "status" varchar NOT NULL,
                "correlation_id" varchar NOT NULL,
                "runner_id" varchar NOT NULL,
                "lease_version" integer NOT NULL,
                "lease_acquired_at" timestamptz NOT NULL,
                "lease_expires_at" timestamptz NOT NULL,
                "started_at" timestamptz NOT NULL,
                "finished_at" timestamptz,
                "failure" jsonb,
                CONSTRAINT "pk_execution_attempt" PRIMARY KEY ("attempt_id"),
                CONSTRAINT "fk_execution_attempt_execution" FOREIGN KEY ("execution_id")
                    REFERENCES "execution_log" ("execution_id") ON DELETE RESTRICT,
                CONSTRAINT "uq_execution_attempt_number" UNIQUE ("execution_id", "attempt_number"),
                CONSTRAINT "uq_execution_attempt_lease_version" UNIQUE ("execution_id", "lease_version"),
                CONSTRAINT "ck_execution_attempt_status" CHECK (
                    "status" IN ('in-progress', 'completed', 'failed', 'timed-out')
                ),
                CONSTRAINT "ck_execution_attempt_state" CHECK (
                    (
                        "status" = 'in-progress'
                        AND "failure" IS NULL
                        AND "finished_at" IS NULL
                    ) OR (
                        "status" = 'completed'
                        AND "failure" IS NULL
                        AND "finished_at" IS NOT NULL
                    ) OR (
                        "status" IN ('failed', 'timed-out')
                        AND "failure" IS NOT NULL
                        AND "finished_at" IS NOT NULL
                    )
                )
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_execution_attempt_correlation_id"
            ON "execution_attempt" ("correlation_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "execution_attempt"');
        await queryRunner.query('DROP TABLE "execution_log"');
    }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUseCaseExecution1787572800000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "use_case_execution" (
                "execution_id" uuid NOT NULL,
                "intent_id" varchar NOT NULL,
                "parent_intent_id" varchar NULL,
                "intent" jsonb NOT NULL,
                "correlation_id" varchar NOT NULL,
                "status" varchar NOT NULL,
                "lease_owner_id" varchar NULL,
                "lease_version" integer NOT NULL,
                "lease_acquired_at" timestamptz NULL,
                "lease_expires_at" timestamptz NULL,
                "result" jsonb NULL,
                "created_at" timestamptz NOT NULL,
                "released_at" timestamptz NULL,
                "completed_at" timestamptz NULL,
                CONSTRAINT "pk_use_case_execution" PRIMARY KEY ("execution_id"),
                CONSTRAINT "uq_use_case_execution_intent_id" UNIQUE ("intent_id"),
                CONSTRAINT "ck_use_case_execution_lease_version" CHECK ("lease_version" >= 1),
                CONSTRAINT "ck_use_case_execution_state" CHECK (
                    (
                        "status" = 'in-progress'
                        AND "lease_owner_id" IS NOT NULL
                        AND "lease_acquired_at" IS NOT NULL
                        AND "lease_expires_at" IS NOT NULL
                        AND "result" IS NULL
                        AND "released_at" IS NULL
                        AND "completed_at" IS NULL
                    ) OR (
                        "status" = 'released'
                        AND "lease_owner_id" IS NULL
                        AND "lease_acquired_at" IS NULL
                        AND "lease_expires_at" IS NULL
                        AND "result" IS NULL
                        AND "released_at" IS NOT NULL
                        AND "completed_at" IS NULL
                    ) OR (
                        "status" = 'completed'
                        AND "lease_owner_id" IS NULL
                        AND "lease_acquired_at" IS NULL
                        AND "lease_expires_at" IS NULL
                        AND "released_at" IS NULL
                        AND "completed_at" IS NOT NULL
                    )
                )
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "use_case_execution"');
    }
}

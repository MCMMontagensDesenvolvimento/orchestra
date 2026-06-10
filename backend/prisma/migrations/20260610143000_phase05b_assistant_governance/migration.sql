-- Phase 05B assistant governance additions.

ALTER TABLE "assistant_versions" ADD COLUMN "description" TEXT;
ALTER TABLE "assistant_versions" ADD COLUMN "configuration" JSONB;
ALTER TABLE "assistant_versions" ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "assistant_shares" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "assistant_shares" ADD COLUMN "workspace_id" UUID;
ALTER TABLE "assistant_shares" ADD COLUMN "target_type" TEXT NOT NULL DEFAULT 'workspace';
ALTER TABLE "assistant_shares" ADD COLUMN "target_user_id" UUID;
ALTER TABLE "assistant_shares" ADD COLUMN "target_workspace_id" UUID;
ALTER TABLE "assistant_shares" ADD COLUMN "target_role_id" UUID;
ALTER TABLE "assistant_shares" ADD COLUMN "permission" TEXT NOT NULL DEFAULT 'can_use';
ALTER TABLE "assistant_shares" ADD COLUMN "created_by_id" UUID;

UPDATE "assistant_shares" AS "share"
SET
  "tenant_id" = "assistant"."tenant_id",
  "workspace_id" = "assistant"."workspace_id",
  "target_type" = "share"."share_type"
FROM "assistants" AS "assistant"
WHERE "share"."assistant_id" = "assistant"."id";

CREATE INDEX "assistant_shares_tenant_id_idx" ON "assistant_shares"("tenant_id");
CREATE INDEX "assistant_shares_workspace_id_idx" ON "assistant_shares"("workspace_id");
CREATE INDEX "assistant_shares_target_user_id_idx" ON "assistant_shares"("target_user_id");
CREATE INDEX "assistant_shares_target_workspace_id_idx" ON "assistant_shares"("target_workspace_id");
CREATE INDEX "assistant_shares_target_role_id_idx" ON "assistant_shares"("target_role_id");

ALTER TABLE "assistant_shares"
  ADD CONSTRAINT "assistant_shares_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "assistant_publications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID NOT NULL,
  "assistant_version_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "published_by_id" UUID NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unpublished_by_id" UUID,
  "unpublished_at" TIMESTAMP(3),
  "rollback_from_publication_id" UUID,
  "rollback_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assistant_publications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_publications_tenant_id_idx" ON "assistant_publications"("tenant_id");
CREATE INDEX "assistant_publications_workspace_id_idx" ON "assistant_publications"("workspace_id");
CREATE INDEX "assistant_publications_assistant_id_idx" ON "assistant_publications"("assistant_id");
CREATE INDEX "assistant_publications_assistant_version_id_idx" ON "assistant_publications"("assistant_version_id");
CREATE INDEX "assistant_publications_status_idx" ON "assistant_publications"("status");
CREATE INDEX "assistant_publications_published_at_idx" ON "assistant_publications"("published_at");
CREATE UNIQUE INDEX "assistant_publications_one_active_idx" ON "assistant_publications"("assistant_id") WHERE "status" = 'active';

ALTER TABLE "assistant_publications"
  ADD CONSTRAINT "assistant_publications_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_publications"
  ADD CONSTRAINT "assistant_publications_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_publications"
  ADD CONSTRAINT "assistant_publications_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_publications"
  ADD CONSTRAINT "assistant_publications_assistant_version_id_fkey"
  FOREIGN KEY ("assistant_version_id") REFERENCES "assistant_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_publications"
  ADD CONSTRAINT "assistant_publications_published_by_id_fkey"
  FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assistant_publications"
  ADD CONSTRAINT "assistant_publications_unpublished_by_id_fkey"
  FOREIGN KEY ("unpublished_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assistant_publications"
  ADD CONSTRAINT "assistant_publications_rollback_from_publication_id_fkey"
  FOREIGN KEY ("rollback_from_publication_id") REFERENCES "assistant_publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "assistant_feedback" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID NOT NULL,
  "assistant_version_id" UUID,
  "conversation_id" TEXT,
  "message_id" TEXT,
  "user_id" UUID NOT NULL,
  "rating" TEXT NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assistant_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_feedback_tenant_id_idx" ON "assistant_feedback"("tenant_id");
CREATE INDEX "assistant_feedback_workspace_id_idx" ON "assistant_feedback"("workspace_id");
CREATE INDEX "assistant_feedback_assistant_id_idx" ON "assistant_feedback"("assistant_id");
CREATE INDEX "assistant_feedback_assistant_version_id_idx" ON "assistant_feedback"("assistant_version_id");
CREATE INDEX "assistant_feedback_user_id_idx" ON "assistant_feedback"("user_id");
CREATE INDEX "assistant_feedback_rating_idx" ON "assistant_feedback"("rating");
CREATE INDEX "assistant_feedback_created_at_idx" ON "assistant_feedback"("created_at");

ALTER TABLE "assistant_feedback"
  ADD CONSTRAINT "assistant_feedback_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_feedback"
  ADD CONSTRAINT "assistant_feedback_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_feedback"
  ADD CONSTRAINT "assistant_feedback_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_feedback"
  ADD CONSTRAINT "assistant_feedback_assistant_version_id_fkey"
  FOREIGN KEY ("assistant_version_id") REFERENCES "assistant_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assistant_feedback"
  ADD CONSTRAINT "assistant_feedback_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "assistant_test_results" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID NOT NULL,
  "assistant_version_id" UUID NOT NULL,
  "tested_by_id" UUID NOT NULL,
  "input" TEXT NOT NULL,
  "expected_behavior" TEXT,
  "actual_output" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "score" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "assistant_test_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_test_results_tenant_id_idx" ON "assistant_test_results"("tenant_id");
CREATE INDEX "assistant_test_results_workspace_id_idx" ON "assistant_test_results"("workspace_id");
CREATE INDEX "assistant_test_results_assistant_id_idx" ON "assistant_test_results"("assistant_id");
CREATE INDEX "assistant_test_results_assistant_version_id_idx" ON "assistant_test_results"("assistant_version_id");
CREATE INDEX "assistant_test_results_tested_by_id_idx" ON "assistant_test_results"("tested_by_id");
CREATE INDEX "assistant_test_results_status_idx" ON "assistant_test_results"("status");
CREATE INDEX "assistant_test_results_created_at_idx" ON "assistant_test_results"("created_at");

ALTER TABLE "assistant_test_results"
  ADD CONSTRAINT "assistant_test_results_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_test_results"
  ADD CONSTRAINT "assistant_test_results_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_test_results"
  ADD CONSTRAINT "assistant_test_results_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_test_results"
  ADD CONSTRAINT "assistant_test_results_assistant_version_id_fkey"
  FOREIGN KEY ("assistant_version_id") REFERENCES "assistant_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_test_results"
  ADD CONSTRAINT "assistant_test_results_tested_by_id_fkey"
  FOREIGN KEY ("tested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 05E runtime boundary and agent run governance.

ALTER TABLE "agent_runs" DROP CONSTRAINT IF EXISTS "agent_runs_user_id_fkey";

ALTER TABLE "agent_runs" RENAME COLUMN "user_id" TO "requested_by_id";

ALTER TABLE "agent_runs" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "agent_runs" ADD COLUMN "workspace_id" UUID;
ALTER TABLE "agent_runs" ADD COLUMN "assistant_version_id" UUID;
ALTER TABLE "agent_runs" ADD COLUMN "assistant_publication_id" UUID;
ALTER TABLE "agent_runs" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE "agent_runs" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'api';
ALTER TABLE "agent_runs" ADD COLUMN "input_summary" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "request_id" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "failed_at" TIMESTAMP(3);
ALTER TABLE "agent_runs" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "agent_runs" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "agent_runs" ADD COLUMN "error_code" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "error_message" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "precheck_snapshot" JSONB;
ALTER TABLE "agent_runs" ADD COLUMN "metadata" JSONB;
ALTER TABLE "agent_runs" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "agent_runs" AS "run"
SET
  "tenant_id" = "assistant"."tenant_id",
  "workspace_id" = "assistant"."workspace_id",
  "requested_by_id" = COALESCE("run"."requested_by_id", "assistant"."created_by_id"),
  "trace_id" = COALESCE("run"."trace_id", 'trace_' || "run"."id"::text)
FROM "assistants" AS "assistant"
WHERE "run"."assistant_id" = "assistant"."id";

ALTER TABLE "agent_runs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "agent_runs" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "agent_runs" ALTER COLUMN "requested_by_id" SET NOT NULL;
ALTER TABLE "agent_runs" ALTER COLUMN "trace_id" SET NOT NULL;
ALTER TABLE "agent_runs" ALTER COLUMN "status" SET DEFAULT 'queued';

CREATE INDEX "agent_runs_tenant_id_idx" ON "agent_runs"("tenant_id");
CREATE INDEX "agent_runs_workspace_id_idx" ON "agent_runs"("workspace_id");
CREATE INDEX "agent_runs_assistant_version_id_idx" ON "agent_runs"("assistant_version_id");
CREATE INDEX "agent_runs_assistant_publication_id_idx" ON "agent_runs"("assistant_publication_id");
CREATE INDEX "agent_runs_requested_by_id_idx" ON "agent_runs"("requested_by_id");
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");
CREATE INDEX "agent_runs_mode_idx" ON "agent_runs"("mode");
CREATE INDEX "agent_runs_created_at_idx" ON "agent_runs"("created_at");

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_assistant_version_id_fkey"
  FOREIGN KEY ("assistant_version_id") REFERENCES "assistant_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_assistant_publication_id_fkey"
  FOREIGN KEY ("assistant_publication_id") REFERENCES "assistant_publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "agent_run_events" (
  "id" UUID NOT NULL,
  "agent_run_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" TEXT,
  "message" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_run_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_run_events_agent_run_id_sequence_key" ON "agent_run_events"("agent_run_id", "sequence");
CREATE INDEX "agent_run_events_agent_run_id_idx" ON "agent_run_events"("agent_run_id");
CREATE INDEX "agent_run_events_tenant_id_idx" ON "agent_run_events"("tenant_id");
CREATE INDEX "agent_run_events_workspace_id_idx" ON "agent_run_events"("workspace_id");
CREATE INDEX "agent_run_events_type_idx" ON "agent_run_events"("type");
CREATE INDEX "agent_run_events_created_at_idx" ON "agent_run_events"("created_at");

ALTER TABLE "agent_run_events"
  ADD CONSTRAINT "agent_run_events_agent_run_id_fkey"
  FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_run_events"
  ADD CONSTRAINT "agent_run_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_run_events"
  ADD CONSTRAINT "agent_run_events_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

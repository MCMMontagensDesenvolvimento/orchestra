-- Phase 05C approval workflow and execution governance additions.

CREATE TABLE "assistant_approval_requests" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID NOT NULL,
  "assistant_version_id" UUID,
  "publication_id" UUID,
  "requested_by_id" UUID NOT NULL,
  "decided_by_id" UUID,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "decision_reason" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "decided_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),

  CONSTRAINT "assistant_approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_approval_requests_tenant_id_idx" ON "assistant_approval_requests"("tenant_id");
CREATE INDEX "assistant_approval_requests_workspace_id_idx" ON "assistant_approval_requests"("workspace_id");
CREATE INDEX "assistant_approval_requests_assistant_id_idx" ON "assistant_approval_requests"("assistant_id");
CREATE INDEX "assistant_approval_requests_assistant_version_id_idx" ON "assistant_approval_requests"("assistant_version_id");
CREATE INDEX "assistant_approval_requests_publication_id_idx" ON "assistant_approval_requests"("publication_id");
CREATE INDEX "assistant_approval_requests_requested_by_id_idx" ON "assistant_approval_requests"("requested_by_id");
CREATE INDEX "assistant_approval_requests_decided_by_id_idx" ON "assistant_approval_requests"("decided_by_id");
CREATE INDEX "assistant_approval_requests_action_idx" ON "assistant_approval_requests"("action");
CREATE INDEX "assistant_approval_requests_status_idx" ON "assistant_approval_requests"("status");
CREATE INDEX "assistant_approval_requests_created_at_idx" ON "assistant_approval_requests"("created_at");

ALTER TABLE "assistant_approval_requests"
  ADD CONSTRAINT "assistant_approval_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_approval_requests"
  ADD CONSTRAINT "assistant_approval_requests_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_approval_requests"
  ADD CONSTRAINT "assistant_approval_requests_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_approval_requests"
  ADD CONSTRAINT "assistant_approval_requests_assistant_version_id_fkey"
  FOREIGN KEY ("assistant_version_id") REFERENCES "assistant_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assistant_approval_requests"
  ADD CONSTRAINT "assistant_approval_requests_publication_id_fkey"
  FOREIGN KEY ("publication_id") REFERENCES "assistant_publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assistant_approval_requests"
  ADD CONSTRAINT "assistant_approval_requests_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assistant_approval_requests"
  ADD CONSTRAINT "assistant_approval_requests_decided_by_id_fkey"
  FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "assistant_execution_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID NOT NULL,
  "execution_mode" TEXT NOT NULL DEFAULT 'draft_test',
  "requires_approval_to_publish" BOOLEAN NOT NULL DEFAULT false,
  "sandbox_enabled" BOOLEAN NOT NULL DEFAULT true,
  "sandbox_requires_auth" BOOLEAN NOT NULL DEFAULT true,
  "sandbox_allowed_for_roles" JSONB,
  "sandbox_blocks_external_tools" BOOLEAN NOT NULL DEFAULT true,
  "sandbox_blocks_real_providers" BOOLEAN NOT NULL DEFAULT true,
  "sandbox_logs_required" BOOLEAN NOT NULL DEFAULT true,
  "sandbox_cost_limit_placeholder" DECIMAL(12,4),
  "allow_draft_testing" BOOLEAN NOT NULL DEFAULT true,
  "allow_published_execution" BOOLEAN NOT NULL DEFAULT false,
  "is_execution_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "updated_by_id" UUID,

  CONSTRAINT "assistant_execution_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_execution_policies_assistant_id_key" ON "assistant_execution_policies"("assistant_id");
CREATE INDEX "assistant_execution_policies_tenant_id_idx" ON "assistant_execution_policies"("tenant_id");
CREATE INDEX "assistant_execution_policies_workspace_id_idx" ON "assistant_execution_policies"("workspace_id");
CREATE INDEX "assistant_execution_policies_execution_mode_idx" ON "assistant_execution_policies"("execution_mode");
CREATE INDEX "assistant_execution_policies_is_execution_enabled_idx" ON "assistant_execution_policies"("is_execution_enabled");

ALTER TABLE "assistant_execution_policies"
  ADD CONSTRAINT "assistant_execution_policies_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_execution_policies"
  ADD CONSTRAINT "assistant_execution_policies_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_execution_policies"
  ADD CONSTRAINT "assistant_execution_policies_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_execution_policies"
  ADD CONSTRAINT "assistant_execution_policies_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "mcp_remote_catalog_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "external_name" VARCHAR(128) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "source" TEXT NOT NULL DEFAULT 'remote_discovery',
    "lifecycle_status" TEXT NOT NULL DEFAULT 'draft',
    "risk_level" TEXT NOT NULL DEFAULT 'medium',
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "spec_hash" CHAR(64) NOT NULL,
    "catalog_hash" CHAR(64) NOT NULL,
    "input_schema" JSONB,
    "output_schema" JSONB,
    "allow_runtime_execution" BOOLEAN NOT NULL DEFAULT false,
    "sandbox_only" BOOLEAN NOT NULL DEFAULT true,
    "blocked_by_default" BOOLEAN NOT NULL DEFAULT true,
    "approval_mode" TEXT NOT NULL DEFAULT 'manual',
    "runtime_enabled" BOOLEAN NOT NULL DEFAULT false,
    "remote_execution_enabled" BOOLEAN NOT NULL DEFAULT false,
    "snapshot_id" VARCHAR(160) NOT NULL,
    "snapshot_hash" CHAR(64) NOT NULL,
    "last_plan_id" VARCHAR(160) NOT NULL,
    "last_plan_hash" CHAR(64) NOT NULL,
    "last_apply_id" VARCHAR(160) NOT NULL,
    "last_apply_hash" CHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "imported_by_user_id" UUID,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "deprecated_by_user_id" UUID,
    "deprecated_at" TIMESTAMP(3),
    "deprecation_reason_hash" CHAR(64),
    "materialized_mcp_tool_id" UUID,
    "internal_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "mcp_remote_catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_remote_catalog_apply_ledgers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "plan_id" VARCHAR(160) NOT NULL,
    "plan_hash" CHAR(64) NOT NULL,
    "snapshot_hash" CHAR(64) NOT NULL,
    "apply_id" VARCHAR(160) NOT NULL,
    "apply_hash" CHAR(64) NOT NULL,
    "idempotency_key" CHAR(64) NOT NULL,
    "approved_by_user_id" UUID,
    "approval_reason_hash" CHAR(64),
    "status" TEXT NOT NULL DEFAULT 'started',
    "summary" JSONB,
    "operation_results" JSONB,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "mcp_remote_catalog_apply_ledgers_pkey" PRIMARY KEY ("id")
);

-- Fail-closed catalog entry invariants that Prisma cannot express directly.
ALTER TABLE "mcp_remote_catalog_entries"
  ADD CONSTRAINT "mcp_remote_catalog_entries_source_check"
    CHECK ("source" IN ('remote_discovery')),
  ADD CONSTRAINT "mcp_remote_catalog_entries_lifecycle_status_check"
    CHECK ("lifecycle_status" IN ('draft', 'blocked', 'approved_for_catalog', 'active', 'deprecated', 'archived')),
  ADD CONSTRAINT "mcp_remote_catalog_entries_risk_level_check"
    CHECK ("risk_level" IN ('low', 'medium', 'high', 'critical')),
  ADD CONSTRAINT "mcp_remote_catalog_entries_revision_positive_check"
    CHECK ("revision" > 0),
  ADD CONSTRAINT "mcp_remote_catalog_entries_allow_runtime_closed_check"
    CHECK ("allow_runtime_execution" = false),
  ADD CONSTRAINT "mcp_remote_catalog_entries_sandbox_only_check"
    CHECK ("sandbox_only" = true),
  ADD CONSTRAINT "mcp_remote_catalog_entries_blocked_by_default_check"
    CHECK ("blocked_by_default" = true),
  ADD CONSTRAINT "mcp_remote_catalog_entries_approval_mode_check"
    CHECK ("approval_mode" = 'manual'),
  ADD CONSTRAINT "mcp_remote_catalog_entries_runtime_disabled_check"
    CHECK ("runtime_enabled" = false),
  ADD CONSTRAINT "mcp_remote_catalog_entries_remote_execution_disabled_check"
    CHECK ("remote_execution_enabled" = false),
  ADD CONSTRAINT "mcp_remote_catalog_entries_spec_hash_check"
    CHECK ("spec_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_entries_catalog_hash_check"
    CHECK ("catalog_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_entries_snapshot_hash_check"
    CHECK ("snapshot_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_entries_last_plan_hash_check"
    CHECK ("last_plan_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_entries_last_apply_hash_check"
    CHECK ("last_apply_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_entries_deprecation_reason_hash_check"
    CHECK ("deprecation_reason_hash" IS NULL OR "deprecation_reason_hash" ~ '^[a-f0-9]{64}$');

-- Ledger idempotency/reconciliation invariants that Prisma cannot express directly.
ALTER TABLE "mcp_remote_catalog_apply_ledgers"
  ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_status_check"
    CHECK ("status" IN ('started', 'applied', 'partially_applied', 'failed', 'blocked', 'no_changes')),
  ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_schema_version_positive_check"
    CHECK ("schema_version" > 0),
  ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_plan_hash_check"
    CHECK ("plan_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_snapshot_hash_check"
    CHECK ("snapshot_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_apply_hash_check"
    CHECK ("apply_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_idempotency_key_check"
    CHECK ("idempotency_key" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_approval_reason_hash_check"
    CHECK ("approval_reason_hash" IS NULL OR "approval_reason_hash" ~ '^[a-f0-9]{64}$');

-- CreateIndex
CREATE UNIQUE INDEX "mcp_remote_catalog_entries_materialized_mcp_tool_id_key" ON "mcp_remote_catalog_entries"("materialized_mcp_tool_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_tenant_id_workspace_id_server_id_idx" ON "mcp_remote_catalog_entries"("tenant_id", "workspace_id", "server_id", "lifecycle_status");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_tenant_id_idx" ON "mcp_remote_catalog_entries"("tenant_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_workspace_id_idx" ON "mcp_remote_catalog_entries"("workspace_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_server_id_idx" ON "mcp_remote_catalog_entries"("server_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_snapshot_hash_idx" ON "mcp_remote_catalog_entries"("snapshot_hash");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_spec_hash_idx" ON "mcp_remote_catalog_entries"("spec_hash");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_catalog_hash_idx" ON "mcp_remote_catalog_entries"("catalog_hash");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_last_plan_hash_idx" ON "mcp_remote_catalog_entries"("last_plan_hash");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_last_apply_hash_idx" ON "mcp_remote_catalog_entries"("last_apply_hash");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_imported_by_user_id_idx" ON "mcp_remote_catalog_entries"("imported_by_user_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_approved_by_user_id_idx" ON "mcp_remote_catalog_entries"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_entries_deprecated_by_user_id_idx" ON "mcp_remote_catalog_entries"("deprecated_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_remote_catalog_entries_tenant_id_workspace_id_server_id_key" ON "mcp_remote_catalog_entries"("tenant_id", "workspace_id", "server_id", "external_name");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_tenant_id_workspace_id_ser_idx" ON "mcp_remote_catalog_apply_ledgers"("tenant_id", "workspace_id", "server_id", "status");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_tenant_id_idx" ON "mcp_remote_catalog_apply_ledgers"("tenant_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_workspace_id_idx" ON "mcp_remote_catalog_apply_ledgers"("workspace_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_server_id_idx" ON "mcp_remote_catalog_apply_ledgers"("server_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_plan_hash_idx" ON "mcp_remote_catalog_apply_ledgers"("plan_hash");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_snapshot_hash_idx" ON "mcp_remote_catalog_apply_ledgers"("snapshot_hash");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_apply_hash_idx" ON "mcp_remote_catalog_apply_ledgers"("apply_hash");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_approved_by_user_id_idx" ON "mcp_remote_catalog_apply_ledgers"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "mcp_remote_catalog_apply_ledgers_created_at_idx" ON "mcp_remote_catalog_apply_ledgers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_remote_catalog_apply_ledgers_scope_idempotency_key" ON "mcp_remote_catalog_apply_ledgers"("tenant_id", "workspace_id", "server_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_remote_catalog_apply_ledgers_scope_apply_key" ON "mcp_remote_catalog_apply_ledgers"("tenant_id", "workspace_id", "server_id", "apply_id");

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_entries" ADD CONSTRAINT "mcp_remote_catalog_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_entries" ADD CONSTRAINT "mcp_remote_catalog_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_entries" ADD CONSTRAINT "mcp_remote_catalog_entries_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_entries" ADD CONSTRAINT "mcp_remote_catalog_entries_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_entries" ADD CONSTRAINT "mcp_remote_catalog_entries_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_entries" ADD CONSTRAINT "mcp_remote_catalog_entries_deprecated_by_user_id_fkey" FOREIGN KEY ("deprecated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_entries" ADD CONSTRAINT "mcp_remote_catalog_entries_materialized_mcp_tool_id_fkey" FOREIGN KEY ("materialized_mcp_tool_id") REFERENCES "mcp_tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_apply_ledgers" ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_apply_ledgers" ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_apply_ledgers" ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_remote_catalog_apply_ledgers" ADD CONSTRAINT "mcp_remote_catalog_apply_ledgers_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

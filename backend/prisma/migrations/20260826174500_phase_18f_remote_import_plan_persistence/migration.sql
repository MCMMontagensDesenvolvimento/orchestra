CREATE TABLE "mcp_remote_catalog_import_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "plan_id" VARCHAR(160) NOT NULL,
    "plan_hash" CHAR(64) NOT NULL,
    "snapshot_id" VARCHAR(160) NOT NULL,
    "snapshot_hash" CHAR(64) NOT NULL,
    "requested_by_user_id" UUID,
    "request_id" VARCHAR(160) NOT NULL,
    "source_decision_status" VARCHAR(64) NOT NULL,
    "plan_status" VARCHAR(64) NOT NULL,
    "review_payload" JSONB NOT NULL,
    "plan_payload" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_remote_catalog_import_plans_pkey"
      PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "mcp_remote_catalog_import_plans_scope_plan_key"
ON "mcp_remote_catalog_import_plans"(
  "tenant_id",
  "workspace_id",
  "server_id",
  "plan_id"
);

CREATE INDEX
  "mcp_remote_catalog_import_plans_tenant_workspace_server_status_idx"
ON "mcp_remote_catalog_import_plans"(
  "tenant_id",
  "workspace_id",
  "server_id",
  "plan_status"
);

CREATE INDEX
  "mcp_remote_catalog_import_plans_plan_hash_idx"
ON "mcp_remote_catalog_import_plans"("plan_hash");

CREATE INDEX
  "mcp_remote_catalog_import_plans_snapshot_hash_idx"
ON "mcp_remote_catalog_import_plans"("snapshot_hash");

CREATE INDEX
  "mcp_remote_catalog_import_plans_requested_by_user_id_idx"
ON "mcp_remote_catalog_import_plans"("requested_by_user_id");

CREATE INDEX
  "mcp_remote_catalog_import_plans_created_at_idx"
ON "mcp_remote_catalog_import_plans"("created_at");

ALTER TABLE "mcp_remote_catalog_import_plans"
ADD CONSTRAINT "mcp_remote_catalog_import_plans_tenant_id_fkey"
FOREIGN KEY ("tenant_id")
REFERENCES "tenants"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "mcp_remote_catalog_import_plans"
ADD CONSTRAINT "mcp_remote_catalog_import_plans_workspace_id_fkey"
FOREIGN KEY ("workspace_id")
REFERENCES "workspaces"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "mcp_remote_catalog_import_plans"
ADD CONSTRAINT "mcp_remote_catalog_import_plans_server_id_fkey"
FOREIGN KEY ("server_id")
REFERENCES "mcp_servers"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "mcp_remote_catalog_import_plans"
ADD CONSTRAINT "mcp_remote_catalog_import_plans_requested_by_user_id_fkey"
FOREIGN KEY ("requested_by_user_id")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

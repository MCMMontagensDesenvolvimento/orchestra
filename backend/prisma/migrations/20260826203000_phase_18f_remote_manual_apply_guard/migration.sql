CREATE UNIQUE INDEX
  "mcp_remote_catalog_apply_ledgers_scope_plan_key"
ON "mcp_remote_catalog_apply_ledgers"(
  "tenant_id",
  "workspace_id",
  "server_id",
  "plan_id"
);

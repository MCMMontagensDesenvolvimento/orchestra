-- Materialize the MCP execution approval RBAC catalog for every environment.
-- This migration creates no roles: it only grants permissions to matching
-- roles that already exist, independently of tenant.
INSERT INTO "permissions" (
  "id",
  "key",
  "description",
  "created_at",
  "updated_at"
)
VALUES
  (gen_random_uuid(), 'mcp.execution_approvals.read', 'Read governed MCP execution approvals.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'mcp.execution_approvals.request', 'Request governed MCP execution approval.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'mcp.execution_approvals.approve', 'Approve governed MCP execution approval.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'mcp.execution_approvals.reject', 'Reject governed MCP execution approval.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'mcp.execution_approvals.cancel', 'Cancel governed MCP execution approval.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

WITH governed_role_permissions ("role_name", "permission_key") AS (
  VALUES
    ('admin_platform', 'mcp.execution_approvals.read'),
    ('admin_platform', 'mcp.execution_approvals.request'),
    ('admin_platform', 'mcp.execution_approvals.approve'),
    ('admin_platform', 'mcp.execution_approvals.reject'),
    ('admin_platform', 'mcp.execution_approvals.cancel'),
    ('creator_owner', 'mcp.execution_approvals.read'),
    ('creator_owner', 'mcp.execution_approvals.request'),
    ('creator_owner', 'mcp.execution_approvals.cancel'),
    ('editor', 'mcp.execution_approvals.read'),
    ('editor', 'mcp.execution_approvals.request'),
    ('editor', 'mcp.execution_approvals.cancel'),
    ('consumer', 'mcp.execution_approvals.read'),
    ('auditor', 'mcp.execution_approvals.read')
)
INSERT INTO "role_permissions" (
  "id",
  "role_id",
  "permission_id",
  "created_at"
)
SELECT
  gen_random_uuid(),
  existing_role."id",
  existing_permission."id",
  CURRENT_TIMESTAMP
FROM governed_role_permissions AS governed
INNER JOIN "roles" AS existing_role
  ON existing_role."name" = governed."role_name"
INNER JOIN "permissions" AS existing_permission
  ON existing_permission."key" = governed."permission_key"
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

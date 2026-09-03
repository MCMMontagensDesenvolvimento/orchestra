-- CreateEnum
CREATE TYPE "McpExecutionApprovalStatus" AS ENUM (
  'pending',
  'approved',
  'claimed',
  'rejected',
  'cancelled',
  'expired',
  'consumed'
);

-- CreateTable
CREATE TABLE "mcp_execution_approvals" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID NOT NULL,
  "assistant_version_id" UUID NOT NULL,
  "mcp_server_id" UUID NOT NULL,
  "mcp_tool_id" UUID NOT NULL,
  "assistant_mcp_binding_id" UUID NOT NULL,
  "requested_by_id" UUID NOT NULL,
  "decided_by_id" UUID,
  "status" "McpExecutionApprovalStatus" NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "decision_reason" TEXT,
  "claimed_by_agent_run_id" UUID,
  "consumed_by_tool_call_id" UUID,
  "approved_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "claimed_at" TIMESTAMP(3),
  "consumed_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mcp_execution_approvals_pkey" PRIMARY KEY ("id")
);

-- One approval can be claimed by at most one AgentRun. This is intentionally
-- a correlation UUID in this phase, because the run is persisted after claim.
CREATE UNIQUE INDEX "mcp_execution_approvals_claimed_by_agent_run_id_key"
  ON "mcp_execution_approvals"("claimed_by_agent_run_id");

CREATE INDEX "mcp_execution_approvals_tenant_id_idx" ON "mcp_execution_approvals"("tenant_id");
CREATE INDEX "mcp_execution_approvals_workspace_id_idx" ON "mcp_execution_approvals"("workspace_id");
CREATE INDEX "mcp_execution_approvals_assistant_id_idx" ON "mcp_execution_approvals"("assistant_id");
CREATE INDEX "mcp_execution_approvals_assistant_version_id_idx" ON "mcp_execution_approvals"("assistant_version_id");
CREATE INDEX "mcp_execution_approvals_mcp_server_id_idx" ON "mcp_execution_approvals"("mcp_server_id");
CREATE INDEX "mcp_execution_approvals_mcp_tool_id_idx" ON "mcp_execution_approvals"("mcp_tool_id");
CREATE INDEX "mcp_execution_approvals_assistant_mcp_binding_id_idx" ON "mcp_execution_approvals"("assistant_mcp_binding_id");
CREATE INDEX "mcp_execution_approvals_requested_by_id_idx" ON "mcp_execution_approvals"("requested_by_id");
CREATE INDEX "mcp_execution_approvals_decided_by_id_idx" ON "mcp_execution_approvals"("decided_by_id");
CREATE INDEX "mcp_execution_approvals_status_idx" ON "mcp_execution_approvals"("status");
CREATE INDEX "mcp_execution_approvals_expires_at_idx" ON "mcp_execution_approvals"("expires_at");
CREATE INDEX "mcp_execution_approvals_consumed_by_tool_call_id_idx" ON "mcp_execution_approvals"("consumed_by_tool_call_id");
CREATE INDEX "mcp_execution_approvals_created_at_idx" ON "mcp_execution_approvals"("created_at");

ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_assistant_id_fkey"
  FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_assistant_version_id_fkey"
  FOREIGN KEY ("assistant_version_id") REFERENCES "assistant_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_mcp_server_id_fkey"
  FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_mcp_tool_id_fkey"
  FOREIGN KEY ("mcp_tool_id") REFERENCES "mcp_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_assistant_mcp_binding_id_fkey"
  FOREIGN KEY ("assistant_mcp_binding_id") REFERENCES "assistant_mcp_bindings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mcp_execution_approvals"
  ADD CONSTRAINT "mcp_execution_approvals_decided_by_id_fkey"
  FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No foreign key is created for consumed_by_tool_call_id in this phase.

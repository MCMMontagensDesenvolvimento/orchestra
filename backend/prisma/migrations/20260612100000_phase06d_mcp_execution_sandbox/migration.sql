-- Fase 06D: MCP execution sandbox controlado.

CREATE TABLE "mcp_tool_calls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "assistant_id" UUID NOT NULL,
    "assistant_version_id" UUID,
    "agent_run_id" UUID,
    "mcp_server_id" UUID NOT NULL,
    "mcp_tool_id" UUID NOT NULL,
    "assistant_mcp_binding_id" UUID,
    "requested_by_user_id" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "risk_level_snapshot" TEXT NOT NULL,
    "approval_required_snapshot" BOOLEAN NOT NULL DEFAULT false,
    "request_id" TEXT,
    "trace_id" TEXT,
    "input_hash" TEXT,
    "input_preview" TEXT,
    "output_preview" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "policy_snapshot" JSONB,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_tool_calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mcp_tool_call_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "tool_call_id" UUID NOT NULL,
    "agent_run_id" UUID,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tool_call_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mcp_tool_calls_tenant_id_idx" ON "mcp_tool_calls"("tenant_id");
CREATE INDEX "mcp_tool_calls_workspace_id_idx" ON "mcp_tool_calls"("workspace_id");
CREATE INDEX "mcp_tool_calls_assistant_id_idx" ON "mcp_tool_calls"("assistant_id");
CREATE INDEX "mcp_tool_calls_assistant_version_id_idx" ON "mcp_tool_calls"("assistant_version_id");
CREATE INDEX "mcp_tool_calls_agent_run_id_idx" ON "mcp_tool_calls"("agent_run_id");
CREATE INDEX "mcp_tool_calls_mcp_server_id_idx" ON "mcp_tool_calls"("mcp_server_id");
CREATE INDEX "mcp_tool_calls_mcp_tool_id_idx" ON "mcp_tool_calls"("mcp_tool_id");
CREATE INDEX "mcp_tool_calls_assistant_mcp_binding_id_idx" ON "mcp_tool_calls"("assistant_mcp_binding_id");
CREATE INDEX "mcp_tool_calls_requested_by_user_id_idx" ON "mcp_tool_calls"("requested_by_user_id");
CREATE INDEX "mcp_tool_calls_status_idx" ON "mcp_tool_calls"("status");
CREATE INDEX "mcp_tool_calls_mode_idx" ON "mcp_tool_calls"("mode");
CREATE INDEX "mcp_tool_calls_risk_level_snapshot_idx" ON "mcp_tool_calls"("risk_level_snapshot");
CREATE INDEX "mcp_tool_calls_request_id_idx" ON "mcp_tool_calls"("request_id");
CREATE INDEX "mcp_tool_calls_trace_id_idx" ON "mcp_tool_calls"("trace_id");
CREATE INDEX "mcp_tool_calls_created_at_idx" ON "mcp_tool_calls"("created_at");
CREATE INDEX "mcp_tool_call_events_tenant_id_idx" ON "mcp_tool_call_events"("tenant_id");
CREATE INDEX "mcp_tool_call_events_workspace_id_idx" ON "mcp_tool_call_events"("workspace_id");
CREATE INDEX "mcp_tool_call_events_tool_call_id_idx" ON "mcp_tool_call_events"("tool_call_id");
CREATE INDEX "mcp_tool_call_events_agent_run_id_idx" ON "mcp_tool_call_events"("agent_run_id");
CREATE INDEX "mcp_tool_call_events_type_idx" ON "mcp_tool_call_events"("type");
CREATE INDEX "mcp_tool_call_events_created_at_idx" ON "mcp_tool_call_events"("created_at");

ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_assistant_version_id_fkey" FOREIGN KEY ("assistant_version_id") REFERENCES "assistant_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_mcp_server_id_fkey" FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_mcp_tool_id_fkey" FOREIGN KEY ("mcp_tool_id") REFERENCES "mcp_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_assistant_mcp_binding_id_fkey" FOREIGN KEY ("assistant_mcp_binding_id") REFERENCES "assistant_mcp_bindings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_call_events" ADD CONSTRAINT "mcp_tool_call_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_call_events" ADD CONSTRAINT "mcp_tool_call_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_call_events" ADD CONSTRAINT "mcp_tool_call_events_tool_call_id_fkey" FOREIGN KEY ("tool_call_id") REFERENCES "mcp_tool_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_call_events" ADD CONSTRAINT "mcp_tool_call_events_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

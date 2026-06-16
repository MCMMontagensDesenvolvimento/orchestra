-- AlterTable
ALTER TABLE "agent_runs" ALTER COLUMN "mode" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "assistant_execution_policies" ADD COLUMN     "allow_external_llm_providers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowed_llm_providers" JSONB,
ADD COLUMN     "default_llm_provider" TEXT;

-- AlterTable
ALTER TABLE "mcp_tool_call_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mcp_tool_calls" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rag_queries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rag_query_results" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "mcp_servers_risk_level_idx" ON "mcp_servers"("risk_level");

-- RenameIndex
ALTER INDEX "assistant_mcp_bindings_assistant_server_tool_key" RENAME TO "assistant_mcp_bindings_assistant_id_mcp_server_id_mcp_tool__key";

-- RenameIndex
ALTER INDEX "mcp_tool_policies_server_tool_key" RENAME TO "mcp_tool_policies_mcp_server_id_mcp_tool_id_key";

-- Phase 06 Knowledge/RAG/MCP catalog and governance.

ALTER TABLE "knowledge_bases" ADD COLUMN "workspace_id" UUID;
ALTER TABLE "knowledge_bases" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'workspace';
ALTER TABLE "knowledge_bases" ADD COLUMN "data_classification" TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE "knowledge_bases" ADD COLUMN "owner_user_id" UUID;
ALTER TABLE "knowledge_bases" ADD COLUMN "metadata" JSONB;
ALTER TABLE "knowledge_bases" ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "knowledge_bases" AS "kb"
SET
  "workspace_id" = "workspace"."id",
  "status" = CASE WHEN "kb"."status" = 'pending' THEN 'active' ELSE "kb"."status" END
FROM "workspaces" AS "workspace"
WHERE "workspace"."tenant_id" = "kb"."tenant_id"
  AND "workspace"."slug" = 'default';

UPDATE "knowledge_bases" AS "kb"
SET "workspace_id" = "workspace"."id"
FROM "workspaces" AS "workspace"
WHERE "workspace"."tenant_id" = "kb"."tenant_id"
  AND "kb"."workspace_id" IS NULL;

ALTER TABLE "knowledge_bases" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "knowledge_bases" ALTER COLUMN "status" SET DEFAULT 'active';

CREATE INDEX "knowledge_bases_workspace_id_idx" ON "knowledge_bases"("workspace_id");
CREATE INDEX "knowledge_bases_status_idx" ON "knowledge_bases"("status");
CREATE INDEX "knowledge_bases_visibility_idx" ON "knowledge_bases"("visibility");
CREATE INDEX "knowledge_bases_data_classification_idx" ON "knowledge_bases"("data_classification");

ALTER TABLE "knowledge_bases"
  ADD CONSTRAINT "knowledge_bases_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_bases"
  ADD CONSTRAINT "knowledge_bases_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mcp_servers" RENAME COLUMN "url" TO "base_url";
ALTER TABLE "mcp_servers" ADD COLUMN "workspace_id" UUID;
ALTER TABLE "mcp_servers" ADD COLUMN "server_type" TEXT NOT NULL DEFAULT 'remote';
ALTER TABLE "mcp_servers" ADD COLUMN "trust_level" TEXT NOT NULL DEFAULT 'restricted';
ALTER TABLE "mcp_servers" ADD COLUMN "auth_type" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "mcp_servers" ADD COLUMN "secret_ref" TEXT;
ALTER TABLE "mcp_servers" ADD COLUMN "metadata" JSONB;
ALTER TABLE "mcp_servers" ADD COLUMN "created_by_id" UUID;
ALTER TABLE "mcp_servers" ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "mcp_servers" AS "server"
SET
  "workspace_id" = "workspace"."id",
  "status" = CASE WHEN "server"."status" = 'inactive' THEN 'disabled' ELSE "server"."status" END
FROM "workspaces" AS "workspace"
WHERE "workspace"."tenant_id" = "server"."tenant_id"
  AND "workspace"."slug" = 'default';

UPDATE "mcp_servers" AS "server"
SET "workspace_id" = "workspace"."id"
FROM "workspaces" AS "workspace"
WHERE "workspace"."tenant_id" = "server"."tenant_id"
  AND "server"."workspace_id" IS NULL;

ALTER TABLE "mcp_servers" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "mcp_servers" ALTER COLUMN "status" SET DEFAULT 'disabled';

CREATE INDEX "mcp_servers_workspace_id_idx" ON "mcp_servers"("workspace_id");
CREATE INDEX "mcp_servers_status_idx" ON "mcp_servers"("status");
CREATE INDEX "mcp_servers_trust_level_idx" ON "mcp_servers"("trust_level");

ALTER TABLE "mcp_servers"
  ADD CONSTRAINT "mcp_servers_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_servers"
  ADD CONSTRAINT "mcp_servers_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mcp_tools" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "mcp_tools" ADD COLUMN "workspace_id" UUID;
ALTER TABLE "mcp_tools" ADD COLUMN "output_schema" JSONB;
ALTER TABLE "mcp_tools" ADD COLUMN "is_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "mcp_tools" ADD COLUMN "metadata" JSONB;
ALTER TABLE "mcp_tools" ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "mcp_tools" AS "tool"
SET
  "tenant_id" = "server"."tenant_id",
  "workspace_id" = "server"."workspace_id",
  "requires_approval" = CASE WHEN "tool"."risk_level" IN ('high', 'critical') THEN true ELSE "tool"."requires_approval" END
FROM "mcp_servers" AS "server"
WHERE "tool"."server_id" = "server"."id";

ALTER TABLE "mcp_tools" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "mcp_tools" ALTER COLUMN "workspace_id" SET NOT NULL;

CREATE INDEX "mcp_tools_tenant_id_idx" ON "mcp_tools"("tenant_id");
CREATE INDEX "mcp_tools_workspace_id_idx" ON "mcp_tools"("workspace_id");
CREATE INDEX "mcp_tools_risk_level_idx" ON "mcp_tools"("risk_level");
CREATE INDEX "mcp_tools_is_enabled_idx" ON "mcp_tools"("is_enabled");

ALTER TABLE "mcp_tools"
  ADD CONSTRAINT "mcp_tools_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_tools"
  ADD CONSTRAINT "mcp_tools_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "knowledge_documents" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "source_type" TEXT NOT NULL DEFAULT 'manual',
  "source_uri" TEXT,
  "mime_type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "ingestion_status" TEXT NOT NULL DEFAULT 'pending',
  "ingestion_error_code" TEXT,
  "ingestion_error_message" TEXT,
  "data_classification" TEXT NOT NULL DEFAULT 'internal',
  "metadata" JSONB,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_documents_tenant_id_idx" ON "knowledge_documents"("tenant_id");
CREATE INDEX "knowledge_documents_workspace_id_idx" ON "knowledge_documents"("workspace_id");
CREATE INDEX "knowledge_documents_knowledge_base_id_idx" ON "knowledge_documents"("knowledge_base_id");
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");
CREATE INDEX "knowledge_documents_ingestion_status_idx" ON "knowledge_documents"("ingestion_status");
CREATE INDEX "knowledge_documents_created_at_idx" ON "knowledge_documents"("created_at");

ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "knowledge_data_sources" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'manual',
  "config" JSONB,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "knowledge_data_sources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_data_sources_tenant_id_idx" ON "knowledge_data_sources"("tenant_id");
CREATE INDEX "knowledge_data_sources_workspace_id_idx" ON "knowledge_data_sources"("workspace_id");
CREATE INDEX "knowledge_data_sources_knowledge_base_id_idx" ON "knowledge_data_sources"("knowledge_base_id");
CREATE INDEX "knowledge_data_sources_status_idx" ON "knowledge_data_sources"("status");

ALTER TABLE "knowledge_data_sources" ADD CONSTRAINT "knowledge_data_sources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_data_sources" ADD CONSTRAINT "knowledge_data_sources_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_data_sources" ADD CONSTRAINT "knowledge_data_sources_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_data_sources" ADD CONSTRAINT "knowledge_data_sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "knowledge_ingestion_jobs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "document_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "error_code" TEXT,
  "error_message" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_ingestion_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_ingestion_jobs_tenant_id_idx" ON "knowledge_ingestion_jobs"("tenant_id");
CREATE INDEX "knowledge_ingestion_jobs_workspace_id_idx" ON "knowledge_ingestion_jobs"("workspace_id");
CREATE INDEX "knowledge_ingestion_jobs_knowledge_base_id_idx" ON "knowledge_ingestion_jobs"("knowledge_base_id");
CREATE INDEX "knowledge_ingestion_jobs_document_id_idx" ON "knowledge_ingestion_jobs"("document_id");
CREATE INDEX "knowledge_ingestion_jobs_status_idx" ON "knowledge_ingestion_jobs"("status");
CREATE INDEX "knowledge_ingestion_jobs_created_at_idx" ON "knowledge_ingestion_jobs"("created_at");

ALTER TABLE "knowledge_ingestion_jobs" ADD CONSTRAINT "knowledge_ingestion_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_jobs" ADD CONSTRAINT "knowledge_ingestion_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_jobs" ADD CONSTRAINT "knowledge_ingestion_jobs_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_jobs" ADD CONSTRAINT "knowledge_ingestion_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "assistant_knowledge_bindings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "retrieval_mode" TEXT NOT NULL DEFAULT 'retrieval_placeholder',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_knowledge_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_knowledge_bindings_assistant_id_knowledge_base_id_key" ON "assistant_knowledge_bindings"("assistant_id", "knowledge_base_id");
CREATE INDEX "assistant_knowledge_bindings_tenant_id_idx" ON "assistant_knowledge_bindings"("tenant_id");
CREATE INDEX "assistant_knowledge_bindings_workspace_id_idx" ON "assistant_knowledge_bindings"("workspace_id");
CREATE INDEX "assistant_knowledge_bindings_assistant_id_idx" ON "assistant_knowledge_bindings"("assistant_id");
CREATE INDEX "assistant_knowledge_bindings_knowledge_base_id_idx" ON "assistant_knowledge_bindings"("knowledge_base_id");
CREATE INDEX "assistant_knowledge_bindings_is_enabled_idx" ON "assistant_knowledge_bindings"("is_enabled");

ALTER TABLE "assistant_knowledge_bindings" ADD CONSTRAINT "assistant_knowledge_bindings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_knowledge_bindings" ADD CONSTRAINT "assistant_knowledge_bindings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_knowledge_bindings" ADD CONSTRAINT "assistant_knowledge_bindings_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_knowledge_bindings" ADD CONSTRAINT "assistant_knowledge_bindings_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_knowledge_bindings" ADD CONSTRAINT "assistant_knowledge_bindings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "knowledge_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "allow_runtime_retrieval" BOOLEAN NOT NULL DEFAULT false,
  "allow_citation_only" BOOLEAN NOT NULL DEFAULT true,
  "require_approval_for_external" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_policies_knowledge_base_id_key" ON "knowledge_policies"("knowledge_base_id");
CREATE INDEX "knowledge_policies_tenant_id_idx" ON "knowledge_policies"("tenant_id");
CREATE INDEX "knowledge_policies_workspace_id_idx" ON "knowledge_policies"("workspace_id");

ALTER TABLE "knowledge_policies" ADD CONSTRAINT "knowledge_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_policies" ADD CONSTRAINT "knowledge_policies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_policies" ADD CONSTRAINT "knowledge_policies_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mcp_resources" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "server_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "uri" TEXT NOT NULL,
  "description" TEXT,
  "mime_type" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "mcp_resources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mcp_resources_tenant_id_idx" ON "mcp_resources"("tenant_id");
CREATE INDEX "mcp_resources_workspace_id_idx" ON "mcp_resources"("workspace_id");
CREATE INDEX "mcp_resources_server_id_idx" ON "mcp_resources"("server_id");

ALTER TABLE "mcp_resources" ADD CONSTRAINT "mcp_resources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_resources" ADD CONSTRAINT "mcp_resources_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_resources" ADD CONSTRAINT "mcp_resources_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mcp_prompts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "server_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "template" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "mcp_prompts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mcp_prompts_tenant_id_idx" ON "mcp_prompts"("tenant_id");
CREATE INDEX "mcp_prompts_workspace_id_idx" ON "mcp_prompts"("workspace_id");
CREATE INDEX "mcp_prompts_server_id_idx" ON "mcp_prompts"("server_id");

ALTER TABLE "mcp_prompts" ADD CONSTRAINT "mcp_prompts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_prompts" ADD CONSTRAINT "mcp_prompts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_prompts" ADD CONSTRAINT "mcp_prompts_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "assistant_mcp_bindings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID NOT NULL,
  "mcp_server_id" UUID NOT NULL,
  "mcp_tool_id" UUID,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "mode" TEXT NOT NULL DEFAULT 'sandbox_only',
  "requires_approval_override" BOOLEAN,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_mcp_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_mcp_bindings_assistant_server_tool_key" ON "assistant_mcp_bindings"("assistant_id", "mcp_server_id", "mcp_tool_id");
CREATE INDEX "assistant_mcp_bindings_tenant_id_idx" ON "assistant_mcp_bindings"("tenant_id");
CREATE INDEX "assistant_mcp_bindings_workspace_id_idx" ON "assistant_mcp_bindings"("workspace_id");
CREATE INDEX "assistant_mcp_bindings_assistant_id_idx" ON "assistant_mcp_bindings"("assistant_id");
CREATE INDEX "assistant_mcp_bindings_mcp_server_id_idx" ON "assistant_mcp_bindings"("mcp_server_id");
CREATE INDEX "assistant_mcp_bindings_mcp_tool_id_idx" ON "assistant_mcp_bindings"("mcp_tool_id");
CREATE INDEX "assistant_mcp_bindings_is_enabled_idx" ON "assistant_mcp_bindings"("is_enabled");

ALTER TABLE "assistant_mcp_bindings" ADD CONSTRAINT "assistant_mcp_bindings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_mcp_bindings" ADD CONSTRAINT "assistant_mcp_bindings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_mcp_bindings" ADD CONSTRAINT "assistant_mcp_bindings_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_mcp_bindings" ADD CONSTRAINT "assistant_mcp_bindings_mcp_server_id_fkey" FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_mcp_bindings" ADD CONSTRAINT "assistant_mcp_bindings_mcp_tool_id_fkey" FOREIGN KEY ("mcp_tool_id") REFERENCES "mcp_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_mcp_bindings" ADD CONSTRAINT "assistant_mcp_bindings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "mcp_tool_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "mcp_server_id" UUID NOT NULL,
  "mcp_tool_id" UUID,
  "allow_runtime_execution" BOOLEAN NOT NULL DEFAULT false,
  "sandbox_only" BOOLEAN NOT NULL DEFAULT true,
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "blocked_by_default" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mcp_tool_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_tool_policies_server_tool_key" ON "mcp_tool_policies"("mcp_server_id", "mcp_tool_id");
CREATE INDEX "mcp_tool_policies_tenant_id_idx" ON "mcp_tool_policies"("tenant_id");
CREATE INDEX "mcp_tool_policies_workspace_id_idx" ON "mcp_tool_policies"("workspace_id");
CREATE INDEX "mcp_tool_policies_mcp_server_id_idx" ON "mcp_tool_policies"("mcp_server_id");
CREATE INDEX "mcp_tool_policies_mcp_tool_id_idx" ON "mcp_tool_policies"("mcp_tool_id");

ALTER TABLE "mcp_tool_policies" ADD CONSTRAINT "mcp_tool_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_policies" ADD CONSTRAINT "mcp_tool_policies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_policies" ADD CONSTRAINT "mcp_tool_policies_mcp_server_id_fkey" FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_tool_policies" ADD CONSTRAINT "mcp_tool_policies_mcp_tool_id_fkey" FOREIGN KEY ("mcp_tool_id") REFERENCES "mcp_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

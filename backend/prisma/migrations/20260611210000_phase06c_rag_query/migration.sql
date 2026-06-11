-- Fase 06C: RAG query local, citations e contrato de retrieval.

CREATE TABLE "rag_queries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "assistant_id" UUID NOT NULL,
    "assistant_version_id" UUID,
    "agent_run_id" UUID,
    "query_text" TEXT NOT NULL,
    "normalized_query" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'local_keyword',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "result_limit" INTEGER NOT NULL DEFAULT 5,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_reason" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_by_id" UUID NOT NULL,
    "request_id" TEXT,
    "trace_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_queries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rag_query_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "rag_query_id" UUID NOT NULL,
    "knowledge_base_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "source_reference_id" UUID,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "match_type" TEXT NOT NULL DEFAULT 'content',
    "excerpt" TEXT NOT NULL,
    "citation_label" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_query_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rag_query_results_rag_query_id_rank_key" ON "rag_query_results"("rag_query_id", "rank");
CREATE INDEX "rag_queries_tenant_id_idx" ON "rag_queries"("tenant_id");
CREATE INDEX "rag_queries_workspace_id_idx" ON "rag_queries"("workspace_id");
CREATE INDEX "rag_queries_assistant_id_idx" ON "rag_queries"("assistant_id");
CREATE INDEX "rag_queries_assistant_version_id_idx" ON "rag_queries"("assistant_version_id");
CREATE INDEX "rag_queries_agent_run_id_idx" ON "rag_queries"("agent_run_id");
CREATE INDEX "rag_queries_created_by_id_idx" ON "rag_queries"("created_by_id");
CREATE INDEX "rag_queries_status_idx" ON "rag_queries"("status");
CREATE INDEX "rag_queries_mode_idx" ON "rag_queries"("mode");
CREATE INDEX "rag_queries_request_id_idx" ON "rag_queries"("request_id");
CREATE INDEX "rag_queries_trace_id_idx" ON "rag_queries"("trace_id");
CREATE INDEX "rag_queries_created_at_idx" ON "rag_queries"("created_at");
CREATE INDEX "rag_query_results_tenant_id_idx" ON "rag_query_results"("tenant_id");
CREATE INDEX "rag_query_results_workspace_id_idx" ON "rag_query_results"("workspace_id");
CREATE INDEX "rag_query_results_rag_query_id_idx" ON "rag_query_results"("rag_query_id");
CREATE INDEX "rag_query_results_knowledge_base_id_idx" ON "rag_query_results"("knowledge_base_id");
CREATE INDEX "rag_query_results_document_id_idx" ON "rag_query_results"("document_id");
CREATE INDEX "rag_query_results_chunk_id_idx" ON "rag_query_results"("chunk_id");
CREATE INDEX "rag_query_results_source_reference_id_idx" ON "rag_query_results"("source_reference_id");
CREATE INDEX "rag_query_results_rank_idx" ON "rag_query_results"("rank");
CREATE INDEX "rag_query_results_created_at_idx" ON "rag_query_results"("created_at");

ALTER TABLE "rag_queries" ADD CONSTRAINT "rag_queries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_queries" ADD CONSTRAINT "rag_queries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_queries" ADD CONSTRAINT "rag_queries_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_queries" ADD CONSTRAINT "rag_queries_assistant_version_id_fkey" FOREIGN KEY ("assistant_version_id") REFERENCES "assistant_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rag_queries" ADD CONSTRAINT "rag_queries_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rag_queries" ADD CONSTRAINT "rag_queries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rag_query_results" ADD CONSTRAINT "rag_query_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_query_results" ADD CONSTRAINT "rag_query_results_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_query_results" ADD CONSTRAINT "rag_query_results_rag_query_id_fkey" FOREIGN KEY ("rag_query_id") REFERENCES "rag_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_query_results" ADD CONSTRAINT "rag_query_results_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_query_results" ADD CONSTRAINT "rag_query_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_query_results" ADD CONSTRAINT "rag_query_results_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rag_query_results" ADD CONSTRAINT "rag_query_results_source_reference_id_fkey" FOREIGN KEY ("source_reference_id") REFERENCES "knowledge_source_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

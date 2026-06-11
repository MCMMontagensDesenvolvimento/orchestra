-- Phase 06B Knowledge ingestion pipeline, local chunking and RAG readiness.

ALTER TABLE "knowledge_documents" ADD COLUMN "content_text" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN "content_hash" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN "ingested_at" TIMESTAMP(3);
ALTER TABLE "knowledge_documents" ADD COLUMN "chunk_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "knowledge_documents_content_hash_idx" ON "knowledge_documents"("content_hash");

ALTER TABLE "knowledge_ingestion_jobs" ADD COLUMN "strategy" TEXT NOT NULL DEFAULT 'local_text_chunking';
ALTER TABLE "knowledge_ingestion_jobs" ADD COLUMN "chunks_created" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "knowledge_ingestion_jobs" ADD COLUMN "source_references_created" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "knowledge_ingestion_jobs" ADD COLUMN "created_by_id" UUID;

UPDATE "knowledge_ingestion_jobs"
SET
  "strategy" = 'placeholder',
  "chunks_created" = 0,
  "source_references_created" = 0
WHERE "status" = 'completed_placeholder';

CREATE INDEX "knowledge_ingestion_jobs_strategy_idx" ON "knowledge_ingestion_jobs"("strategy");
CREATE INDEX "knowledge_ingestion_jobs_created_by_id_idx" ON "knowledge_ingestion_jobs"("created_by_id");

ALTER TABLE "knowledge_ingestion_jobs"
  ADD CONSTRAINT "knowledge_ingestion_jobs_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "knowledge_chunks" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "token_estimate" INTEGER NOT NULL DEFAULT 0,
  "char_count" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_chunks_tenant_id_idx" ON "knowledge_chunks"("tenant_id");
CREATE INDEX "knowledge_chunks_workspace_id_idx" ON "knowledge_chunks"("workspace_id");
CREATE INDEX "knowledge_chunks_knowledge_base_id_idx" ON "knowledge_chunks"("knowledge_base_id");
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");
CREATE INDEX "knowledge_chunks_chunk_index_idx" ON "knowledge_chunks"("chunk_index");
CREATE INDEX "knowledge_chunks_content_hash_idx" ON "knowledge_chunks"("content_hash");
CREATE INDEX "knowledge_chunks_status_idx" ON "knowledge_chunks"("status");
CREATE INDEX "knowledge_chunks_created_at_idx" ON "knowledge_chunks"("created_at");

ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "knowledge_source_references" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "chunk_id" UUID,
  "label" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'manual',
  "source_uri" TEXT,
  "section_title" TEXT,
  "page_number" INTEGER,
  "start_offset" INTEGER,
  "end_offset" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_source_references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_source_references_tenant_id_idx" ON "knowledge_source_references"("tenant_id");
CREATE INDEX "knowledge_source_references_workspace_id_idx" ON "knowledge_source_references"("workspace_id");
CREATE INDEX "knowledge_source_references_knowledge_base_id_idx" ON "knowledge_source_references"("knowledge_base_id");
CREATE INDEX "knowledge_source_references_document_id_idx" ON "knowledge_source_references"("document_id");
CREATE INDEX "knowledge_source_references_chunk_id_idx" ON "knowledge_source_references"("chunk_id");
CREATE INDEX "knowledge_source_references_source_type_idx" ON "knowledge_source_references"("source_type");

ALTER TABLE "knowledge_source_references" ADD CONSTRAINT "knowledge_source_references_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_source_references" ADD CONSTRAINT "knowledge_source_references_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_source_references" ADD CONSTRAINT "knowledge_source_references_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_source_references" ADD CONSTRAINT "knowledge_source_references_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_source_references" ADD CONSTRAINT "knowledge_source_references_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "knowledge_ingestion_events" (
  "id" UUID NOT NULL,
  "job_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "document_id" UUID,
  "event_type" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "message" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_ingestion_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_ingestion_events_job_id_idx" ON "knowledge_ingestion_events"("job_id");
CREATE INDEX "knowledge_ingestion_events_tenant_id_idx" ON "knowledge_ingestion_events"("tenant_id");
CREATE INDEX "knowledge_ingestion_events_workspace_id_idx" ON "knowledge_ingestion_events"("workspace_id");
CREATE INDEX "knowledge_ingestion_events_knowledge_base_id_idx" ON "knowledge_ingestion_events"("knowledge_base_id");
CREATE INDEX "knowledge_ingestion_events_document_id_idx" ON "knowledge_ingestion_events"("document_id");
CREATE INDEX "knowledge_ingestion_events_event_type_idx" ON "knowledge_ingestion_events"("event_type");
CREATE INDEX "knowledge_ingestion_events_level_idx" ON "knowledge_ingestion_events"("level");
CREATE INDEX "knowledge_ingestion_events_created_at_idx" ON "knowledge_ingestion_events"("created_at");

ALTER TABLE "knowledge_ingestion_events" ADD CONSTRAINT "knowledge_ingestion_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "knowledge_ingestion_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_events" ADD CONSTRAINT "knowledge_ingestion_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_events" ADD CONSTRAINT "knowledge_ingestion_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_events" ADD CONSTRAINT "knowledge_ingestion_events_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_events" ADD CONSTRAINT "knowledge_ingestion_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fase 10C: pgvector + tabela separada para embeddings de chunks.
-- Esta migration exige uma imagem/infraestrutura PostgreSQL com a extensao pgvector disponivel.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'vector'
  ) THEN
    RAISE EXCEPTION 'pgvector extension is not available. Use a PostgreSQL image/runtime with pgvector before applying this migration.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "knowledge_chunk_embeddings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "knowledge_base_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "chunk_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "dimension" INTEGER NOT NULL,
  "embedding" vector,
  "content_hash" TEXT NOT NULL,
  "embedding_hash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error_code" TEXT,
  "error_message" TEXT,
  "embedded_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "knowledge_chunk_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_chunk_embeddings_chunk_provider_model_dim_hash_key"
  ON "knowledge_chunk_embeddings"("chunk_id", "provider", "model", "dimension", "content_hash");

CREATE INDEX "knowledge_chunk_embeddings_tenant_id_idx"
  ON "knowledge_chunk_embeddings"("tenant_id");

CREATE INDEX "knowledge_chunk_embeddings_workspace_id_idx"
  ON "knowledge_chunk_embeddings"("workspace_id");

CREATE INDEX "knowledge_chunk_embeddings_knowledge_base_id_idx"
  ON "knowledge_chunk_embeddings"("knowledge_base_id");

CREATE INDEX "knowledge_chunk_embeddings_document_id_idx"
  ON "knowledge_chunk_embeddings"("document_id");

CREATE INDEX "knowledge_chunk_embeddings_chunk_id_idx"
  ON "knowledge_chunk_embeddings"("chunk_id");

CREATE INDEX "knowledge_chunk_embeddings_provider_model_idx"
  ON "knowledge_chunk_embeddings"("provider", "model");

CREATE INDEX "knowledge_chunk_embeddings_status_idx"
  ON "knowledge_chunk_embeddings"("status");

CREATE INDEX "knowledge_chunk_embeddings_content_hash_idx"
  ON "knowledge_chunk_embeddings"("content_hash");

CREATE INDEX "knowledge_chunk_embeddings_embedded_at_idx"
  ON "knowledge_chunk_embeddings"("embedded_at");

CREATE INDEX "knowledge_chunk_embeddings_created_at_idx"
  ON "knowledge_chunk_embeddings"("created_at");

ALTER TABLE "knowledge_chunk_embeddings"
  ADD CONSTRAINT "knowledge_chunk_embeddings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunk_embeddings"
  ADD CONSTRAINT "knowledge_chunk_embeddings_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunk_embeddings"
  ADD CONSTRAINT "knowledge_chunk_embeddings_knowledge_base_id_fkey"
  FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunk_embeddings"
  ADD CONSTRAINT "knowledge_chunk_embeddings_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunk_embeddings"
  ADD CONSTRAINT "knowledge_chunk_embeddings_chunk_id_fkey"
  FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

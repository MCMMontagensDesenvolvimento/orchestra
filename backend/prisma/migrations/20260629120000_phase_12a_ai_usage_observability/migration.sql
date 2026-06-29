CREATE TABLE "ai_run_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "assistant_id" UUID,
  "user_id" UUID,
  "run_id" VARCHAR(160) NOT NULL,
  "trace_id" VARCHAR(160),
  "source" VARCHAR(40) NOT NULL,
  "operation" VARCHAR(80) NOT NULL,
  "provider" VARCHAR(80),
  "model" VARCHAR(160),
  "status" VARCHAR(40) NOT NULL,
  "blocked_reason" VARCHAR(160),
  "error_code" VARCHAR(120),
  "error_message_hash" CHAR(64),
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "total_tokens" INTEGER,
  "embedding_tokens" INTEGER,
  "cached_tokens" INTEGER,
  "latency_ms" INTEGER,
  "cost_currency" CHAR(3),
  "estimated_cost_minor_units" BIGINT,
  "metadata" JSONB,
  "started_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_run_usage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_run_usage_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_run_usage_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_run_usage_events_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_run_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_run_usage_events_source_check" CHECK ("source" IN ('llm_provider', 'rag', 'mcp', 'runtime_adapter', 'embedding', 'unknown')),
  CONSTRAINT "ai_run_usage_events_status_check" CHECK ("status" IN ('started', 'succeeded', 'failed', 'blocked', 'cancelled')),
  CONSTRAINT "ai_run_usage_events_token_nonnegative_check" CHECK (
    ("input_tokens" IS NULL OR "input_tokens" >= 0)
    AND ("output_tokens" IS NULL OR "output_tokens" >= 0)
    AND ("total_tokens" IS NULL OR "total_tokens" >= 0)
    AND ("embedding_tokens" IS NULL OR "embedding_tokens" >= 0)
    AND ("cached_tokens" IS NULL OR "cached_tokens" >= 0)
  ),
  CONSTRAINT "ai_run_usage_events_latency_nonnegative_check" CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0),
  CONSTRAINT "ai_run_usage_events_cost_nonnegative_check" CHECK ("estimated_cost_minor_units" IS NULL OR "estimated_cost_minor_units" >= 0),
  CONSTRAINT "ai_run_usage_events_error_message_hash_check" CHECK ("error_message_hash" IS NULL OR "error_message_hash" ~ '^[a-f0-9]{64}$')
);

CREATE INDEX "ai_run_usage_events_tenant_id_idx" ON "ai_run_usage_events"("tenant_id");
CREATE INDEX "ai_run_usage_events_workspace_id_idx" ON "ai_run_usage_events"("workspace_id");
CREATE INDEX "ai_run_usage_events_assistant_id_idx" ON "ai_run_usage_events"("assistant_id");
CREATE INDEX "ai_run_usage_events_user_id_idx" ON "ai_run_usage_events"("user_id");
CREATE INDEX "ai_run_usage_events_run_id_idx" ON "ai_run_usage_events"("run_id");
CREATE INDEX "ai_run_usage_events_trace_id_idx" ON "ai_run_usage_events"("trace_id");
CREATE INDEX "ai_run_usage_events_source_idx" ON "ai_run_usage_events"("source");
CREATE INDEX "ai_run_usage_events_operation_idx" ON "ai_run_usage_events"("operation");
CREATE INDEX "ai_run_usage_events_status_idx" ON "ai_run_usage_events"("status");
CREATE INDEX "ai_run_usage_events_provider_model_idx" ON "ai_run_usage_events"("provider", "model");
CREATE INDEX "ai_run_usage_events_started_at_idx" ON "ai_run_usage_events"("started_at");
CREATE INDEX "ai_run_usage_events_created_at_idx" ON "ai_run_usage_events"("created_at");

CREATE TABLE "ai_usage_limit_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID,
  "assistant_id" UUID,
  "user_id" UUID,
  "scope_type" VARCHAR(20) NOT NULL,
  "metric" VARCHAR(40) NOT NULL,
  "period" VARCHAR(20) NOT NULL,
  "mode" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "limit_value" BIGINT NOT NULL,
  "warn_threshold_value" BIGINT,
  "source" VARCHAR(40),
  "operation" VARCHAR(80),
  "provider" VARCHAR(80),
  "model" VARCHAR(160),
  "description" TEXT,
  "metadata" JSONB,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "ai_usage_limit_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_usage_limit_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_limit_policies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_limit_policies_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_limit_policies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_limit_policies_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_limit_policies_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_limit_policies_scope_type_check" CHECK ("scope_type" IN ('tenant', 'workspace', 'assistant', 'user')),
  CONSTRAINT "ai_usage_limit_policies_metric_check" CHECK ("metric" IN ('run_count', 'total_tokens', 'input_tokens', 'output_tokens', 'embedding_tokens', 'cached_tokens', 'estimated_cost_minor_units', 'failed_run_count', 'blocked_run_count')),
  CONSTRAINT "ai_usage_limit_policies_period_check" CHECK ("period" IN ('minute', 'hour', 'day', 'month')),
  CONSTRAINT "ai_usage_limit_policies_mode_check" CHECK ("mode" IN ('monitor_only', 'enforce')),
  CONSTRAINT "ai_usage_limit_policies_status_check" CHECK ("status" IN ('active', 'disabled')),
  CONSTRAINT "ai_usage_limit_policies_limit_value_check" CHECK ("limit_value" > 0),
  CONSTRAINT "ai_usage_limit_policies_warn_threshold_check" CHECK ("warn_threshold_value" IS NULL OR ("warn_threshold_value" >= 0 AND "warn_threshold_value" <= "limit_value")),
  CONSTRAINT "ai_usage_limit_policies_scope_target_check" CHECK (
    ("scope_type" = 'tenant' AND "workspace_id" IS NULL AND "assistant_id" IS NULL AND "user_id" IS NULL)
    OR ("scope_type" = 'workspace' AND "workspace_id" IS NOT NULL AND "assistant_id" IS NULL AND "user_id" IS NULL)
    OR ("scope_type" = 'assistant' AND "workspace_id" IS NULL AND "assistant_id" IS NOT NULL AND "user_id" IS NULL)
    OR ("scope_type" = 'user' AND "workspace_id" IS NULL AND "assistant_id" IS NULL AND "user_id" IS NOT NULL)
  )
);

CREATE INDEX "ai_usage_limit_policies_tenant_id_idx" ON "ai_usage_limit_policies"("tenant_id");
CREATE INDEX "ai_usage_limit_policies_workspace_id_idx" ON "ai_usage_limit_policies"("workspace_id");
CREATE INDEX "ai_usage_limit_policies_assistant_id_idx" ON "ai_usage_limit_policies"("assistant_id");
CREATE INDEX "ai_usage_limit_policies_user_id_idx" ON "ai_usage_limit_policies"("user_id");
CREATE INDEX "ai_usage_limit_policies_scope_type_idx" ON "ai_usage_limit_policies"("scope_type");
CREATE INDEX "ai_usage_limit_policies_metric_idx" ON "ai_usage_limit_policies"("metric");
CREATE INDEX "ai_usage_limit_policies_period_idx" ON "ai_usage_limit_policies"("period");
CREATE INDEX "ai_usage_limit_policies_mode_idx" ON "ai_usage_limit_policies"("mode");
CREATE INDEX "ai_usage_limit_policies_status_idx" ON "ai_usage_limit_policies"("status");
CREATE INDEX "ai_usage_limit_policies_source_idx" ON "ai_usage_limit_policies"("source");
CREATE INDEX "ai_usage_limit_policies_operation_idx" ON "ai_usage_limit_policies"("operation");
CREATE INDEX "ai_usage_limit_policies_provider_model_idx" ON "ai_usage_limit_policies"("provider", "model");
CREATE INDEX "ai_usage_limit_policies_created_at_idx" ON "ai_usage_limit_policies"("created_at");
CREATE INDEX "ai_usage_limit_policies_tenant_id_status_deleted_at_idx" ON "ai_usage_limit_policies"("tenant_id", "status", "deleted_at");

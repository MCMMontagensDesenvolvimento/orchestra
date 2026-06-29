CREATE TABLE "ai_observability_alert_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID,
  "assistant_id" UUID,
  "user_id" UUID,
  "scope_type" VARCHAR(20) NOT NULL,
  "metric" VARCHAR(40) NOT NULL,
  "period" VARCHAR(20) NOT NULL,
  "operator" VARCHAR(10) NOT NULL,
  "threshold_value" BIGINT NOT NULL,
  "severity" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "source" VARCHAR(40),
  "operation" VARCHAR(80),
  "provider" VARCHAR(80),
  "model" VARCHAR(160),
  "description" TEXT,
  "metadata" JSONB,
  "cooldown_minutes" INTEGER,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "ai_observability_alert_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_observability_alert_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_observability_alert_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_observability_alert_rules_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_observability_alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_observability_alert_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_observability_alert_rules_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_observability_alert_rules_scope_type_check" CHECK ("scope_type" IN ('tenant', 'workspace', 'assistant', 'user')),
  CONSTRAINT "ai_observability_alert_rules_metric_check" CHECK ("metric" IN ('event_count', 'run_count', 'total_tokens', 'input_tokens', 'output_tokens', 'embedding_tokens', 'cached_tokens', 'estimated_cost_minor_units', 'avg_latency_ms', 'failed_run_count', 'blocked_run_count')),
  CONSTRAINT "ai_observability_alert_rules_period_check" CHECK ("period" IN ('minute', 'hour', 'day', 'month')),
  CONSTRAINT "ai_observability_alert_rules_operator_check" CHECK ("operator" IN ('gt', 'gte', 'eq')),
  CONSTRAINT "ai_observability_alert_rules_severity_check" CHECK ("severity" IN ('info', 'warning', 'critical')),
  CONSTRAINT "ai_observability_alert_rules_status_check" CHECK ("status" IN ('active', 'disabled')),
  CONSTRAINT "ai_observability_alert_rules_threshold_value_check" CHECK ("threshold_value" >= 0),
  CONSTRAINT "ai_observability_alert_rules_cooldown_minutes_check" CHECK ("cooldown_minutes" IS NULL OR "cooldown_minutes" >= 0),
  CONSTRAINT "ai_observability_alert_rules_scope_target_check" CHECK (
    ("scope_type" = 'tenant' AND "workspace_id" IS NULL AND "assistant_id" IS NULL AND "user_id" IS NULL)
    OR ("scope_type" = 'workspace' AND "workspace_id" IS NOT NULL AND "assistant_id" IS NULL AND "user_id" IS NULL)
    OR ("scope_type" = 'assistant' AND "workspace_id" IS NULL AND "assistant_id" IS NOT NULL AND "user_id" IS NULL)
    OR ("scope_type" = 'user' AND "workspace_id" IS NULL AND "assistant_id" IS NULL AND "user_id" IS NOT NULL)
  )
);

CREATE INDEX "ai_observability_alert_rules_tenant_id_idx" ON "ai_observability_alert_rules"("tenant_id");
CREATE INDEX "ai_observability_alert_rules_workspace_id_idx" ON "ai_observability_alert_rules"("workspace_id");
CREATE INDEX "ai_observability_alert_rules_assistant_id_idx" ON "ai_observability_alert_rules"("assistant_id");
CREATE INDEX "ai_observability_alert_rules_user_id_idx" ON "ai_observability_alert_rules"("user_id");
CREATE INDEX "ai_observability_alert_rules_scope_type_idx" ON "ai_observability_alert_rules"("scope_type");
CREATE INDEX "ai_observability_alert_rules_metric_idx" ON "ai_observability_alert_rules"("metric");
CREATE INDEX "ai_observability_alert_rules_period_idx" ON "ai_observability_alert_rules"("period");
CREATE INDEX "ai_observability_alert_rules_operator_idx" ON "ai_observability_alert_rules"("operator");
CREATE INDEX "ai_observability_alert_rules_severity_idx" ON "ai_observability_alert_rules"("severity");
CREATE INDEX "ai_observability_alert_rules_status_idx" ON "ai_observability_alert_rules"("status");
CREATE INDEX "ai_observability_alert_rules_source_idx" ON "ai_observability_alert_rules"("source");
CREATE INDEX "ai_observability_alert_rules_operation_idx" ON "ai_observability_alert_rules"("operation");
CREATE INDEX "ai_observability_alert_rules_provider_model_idx" ON "ai_observability_alert_rules"("provider", "model");
CREATE INDEX "ai_observability_alert_rules_created_at_idx" ON "ai_observability_alert_rules"("created_at");
CREATE INDEX "ai_observability_alert_rules_tenant_id_status_deleted_at_idx" ON "ai_observability_alert_rules"("tenant_id", "status", "deleted_at");

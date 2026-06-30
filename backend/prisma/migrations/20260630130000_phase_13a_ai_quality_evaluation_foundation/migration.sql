CREATE TABLE "ai_quality_test_sets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID,
  "assistant_id" UUID,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "ai_quality_test_sets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_quality_test_sets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_test_sets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_test_sets_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_test_sets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_test_sets_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_test_sets_status_check" CHECK ("status" IN ('active', 'disabled', 'archived')),
  CONSTRAINT "ai_quality_test_sets_name_check" CHECK (length(trim("name")) > 0)
);

CREATE TABLE "ai_quality_test_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "test_set_id" UUID NOT NULL,
  "assistant_id" UUID,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "input_text" TEXT NOT NULL,
  "expected_output" TEXT,
  "assertions" JSONB NOT NULL,
  "tags" JSONB,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "ai_quality_test_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_quality_test_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_test_cases_test_set_id_fkey" FOREIGN KEY ("test_set_id") REFERENCES "ai_quality_test_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_test_cases_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_test_cases_status_check" CHECK ("status" IN ('active', 'disabled', 'archived')),
  CONSTRAINT "ai_quality_test_cases_name_check" CHECK (length(trim("name")) > 0),
  CONSTRAINT "ai_quality_test_cases_sort_order_check" CHECK ("sort_order" >= 0),
  CONSTRAINT "ai_quality_test_cases_input_text_size_check" CHECK (char_length("input_text") <= 8000),
  CONSTRAINT "ai_quality_test_cases_expected_output_size_check" CHECK ("expected_output" IS NULL OR char_length("expected_output") <= 8000),
  CONSTRAINT "ai_quality_test_cases_assertions_json_check" CHECK (jsonb_typeof("assertions") = 'array'),
  CONSTRAINT "ai_quality_test_cases_tags_json_check" CHECK ("tags" IS NULL OR jsonb_typeof("tags") = 'array')
);

CREATE TABLE "ai_quality_evaluation_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID,
  "assistant_id" UUID,
  "test_set_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'created',
  "mode" VARCHAR(40) NOT NULL DEFAULT 'deterministic',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "total_cases" INTEGER NOT NULL DEFAULT 0,
  "passed_cases" INTEGER NOT NULL DEFAULT 0,
  "failed_cases" INTEGER NOT NULL DEFAULT 0,
  "warning_cases" INTEGER NOT NULL DEFAULT 0,
  "error_cases" INTEGER NOT NULL DEFAULT 0,
  "skipped_cases" INTEGER NOT NULL DEFAULT 0,
  "score_basis_points" INTEGER,
  "metadata" JSONB,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "ai_quality_evaluation_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_quality_evaluation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_evaluation_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_evaluation_runs_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_evaluation_runs_test_set_id_fkey" FOREIGN KEY ("test_set_id") REFERENCES "ai_quality_test_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_evaluation_runs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_evaluation_runs_status_check" CHECK ("status" IN ('created', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT "ai_quality_evaluation_runs_mode_check" CHECK ("mode" IN ('manual_snapshot', 'deterministic')),
  CONSTRAINT "ai_quality_evaluation_runs_counts_check" CHECK (
    "total_cases" >= 0
    AND "passed_cases" >= 0
    AND "failed_cases" >= 0
    AND "warning_cases" >= 0
    AND "error_cases" >= 0
    AND "skipped_cases" >= 0
  ),
  CONSTRAINT "ai_quality_evaluation_runs_score_check" CHECK ("score_basis_points" IS NULL OR ("score_basis_points" >= 0 AND "score_basis_points" <= 10000)),
  CONSTRAINT "ai_quality_evaluation_runs_completed_at_check" CHECK ("completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at")
);

CREATE TABLE "ai_quality_evaluation_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "test_case_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "score_basis_points" INTEGER NOT NULL,
  "assertion_results" JSONB NOT NULL,
  "candidate_output_hash" CHAR(64),
  "candidate_output_excerpt" VARCHAR(512),
  "error_code" VARCHAR(120),
  "error_message_hash" CHAR(64),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_quality_evaluation_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_quality_evaluation_results_run_case_key" UNIQUE ("run_id", "test_case_id"),
  CONSTRAINT "ai_quality_evaluation_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_evaluation_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_quality_evaluation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_evaluation_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "ai_quality_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_quality_evaluation_results_status_check" CHECK ("status" IN ('passed', 'failed', 'warning', 'error', 'skipped')),
  CONSTRAINT "ai_quality_evaluation_results_score_check" CHECK ("score_basis_points" >= 0 AND "score_basis_points" <= 10000),
  CONSTRAINT "ai_quality_evaluation_results_assertion_results_json_check" CHECK (jsonb_typeof("assertion_results") = 'array'),
  CONSTRAINT "ai_quality_evaluation_results_candidate_output_hash_check" CHECK ("candidate_output_hash" IS NULL OR "candidate_output_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ai_quality_evaluation_results_error_message_hash_check" CHECK ("error_message_hash" IS NULL OR "error_message_hash" ~ '^[a-f0-9]{64}$')
);

CREATE INDEX "ai_quality_test_sets_tenant_id_idx" ON "ai_quality_test_sets"("tenant_id");
CREATE INDEX "ai_quality_test_sets_workspace_id_idx" ON "ai_quality_test_sets"("workspace_id");
CREATE INDEX "ai_quality_test_sets_assistant_id_idx" ON "ai_quality_test_sets"("assistant_id");
CREATE INDEX "ai_quality_test_sets_status_idx" ON "ai_quality_test_sets"("status");
CREATE INDEX "ai_quality_test_sets_created_at_idx" ON "ai_quality_test_sets"("created_at");
CREATE INDEX "ai_quality_test_sets_tenant_id_status_deleted_at_idx" ON "ai_quality_test_sets"("tenant_id", "status", "deleted_at");

CREATE INDEX "ai_quality_test_cases_tenant_id_idx" ON "ai_quality_test_cases"("tenant_id");
CREATE INDEX "ai_quality_test_cases_test_set_id_idx" ON "ai_quality_test_cases"("test_set_id");
CREATE INDEX "ai_quality_test_cases_assistant_id_idx" ON "ai_quality_test_cases"("assistant_id");
CREATE INDEX "ai_quality_test_cases_status_idx" ON "ai_quality_test_cases"("status");
CREATE INDEX "ai_quality_test_cases_sort_order_idx" ON "ai_quality_test_cases"("sort_order");
CREATE INDEX "ai_quality_test_cases_created_at_idx" ON "ai_quality_test_cases"("created_at");
CREATE INDEX "ai_quality_test_cases_tenant_id_status_deleted_at_idx" ON "ai_quality_test_cases"("tenant_id", "status", "deleted_at");

CREATE INDEX "ai_quality_evaluation_runs_tenant_id_idx" ON "ai_quality_evaluation_runs"("tenant_id");
CREATE INDEX "ai_quality_evaluation_runs_workspace_id_idx" ON "ai_quality_evaluation_runs"("workspace_id");
CREATE INDEX "ai_quality_evaluation_runs_assistant_id_idx" ON "ai_quality_evaluation_runs"("assistant_id");
CREATE INDEX "ai_quality_evaluation_runs_test_set_id_idx" ON "ai_quality_evaluation_runs"("test_set_id");
CREATE INDEX "ai_quality_evaluation_runs_status_idx" ON "ai_quality_evaluation_runs"("status");
CREATE INDEX "ai_quality_evaluation_runs_mode_idx" ON "ai_quality_evaluation_runs"("mode");
CREATE INDEX "ai_quality_evaluation_runs_created_at_idx" ON "ai_quality_evaluation_runs"("created_at");
CREATE INDEX "ai_quality_evaluation_runs_tenant_id_status_deleted_at_idx" ON "ai_quality_evaluation_runs"("tenant_id", "status", "deleted_at");

CREATE INDEX "ai_quality_evaluation_results_tenant_id_idx" ON "ai_quality_evaluation_results"("tenant_id");
CREATE INDEX "ai_quality_evaluation_results_run_id_idx" ON "ai_quality_evaluation_results"("run_id");
CREATE INDEX "ai_quality_evaluation_results_test_case_id_idx" ON "ai_quality_evaluation_results"("test_case_id");
CREATE INDEX "ai_quality_evaluation_results_status_idx" ON "ai_quality_evaluation_results"("status");
CREATE INDEX "ai_quality_evaluation_results_created_at_idx" ON "ai_quality_evaluation_results"("created_at");

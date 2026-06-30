ALTER TABLE "ai_quality_evaluation_runs"
  ADD COLUMN "assistant_snapshot_hash" CHAR(64),
  ADD COLUMN "assistant_snapshot_summary" JSONB,
  ADD COLUMN "test_set_snapshot_hash" CHAR(64),
  ADD COLUMN "test_set_snapshot_summary" JSONB;

ALTER TABLE "ai_quality_evaluation_runs"
  ADD CONSTRAINT "ai_quality_evaluation_runs_assistant_snapshot_hash_check"
    CHECK ("assistant_snapshot_hash" IS NULL OR "assistant_snapshot_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "ai_quality_evaluation_runs_test_set_snapshot_hash_check"
    CHECK ("test_set_snapshot_hash" IS NULL OR "test_set_snapshot_hash" ~ '^[a-f0-9]{64}$');

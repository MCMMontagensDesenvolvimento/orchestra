ALTER TABLE "ai_quality_test_cases"
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "updated_by_user_id" UUID;

CREATE INDEX "ai_quality_test_cases_created_by_user_id_idx"
  ON "ai_quality_test_cases"("created_by_user_id");

CREATE INDEX "ai_quality_test_cases_updated_by_user_id_idx"
  ON "ai_quality_test_cases"("updated_by_user_id");

ALTER TABLE "ai_quality_test_cases"
  ADD CONSTRAINT "ai_quality_test_cases_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_quality_test_cases"
  ADD CONSTRAINT "ai_quality_test_cases_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

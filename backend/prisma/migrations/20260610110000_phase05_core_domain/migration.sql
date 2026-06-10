-- Phase 05 core-domain additions.
ALTER TABLE "workspaces" ADD COLUMN "description" TEXT;

CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

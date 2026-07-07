-- Fase 15C: conversas persistentes privadas por usuario, preparadas para visibilidade futura.

ALTER TABLE "conversations"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "workspace_id" UUID,
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN "archived_at" TIMESTAMP(3);

UPDATE "conversations" AS c
SET
  "tenant_id" = a."tenant_id",
  "workspace_id" = a."workspace_id"
FROM "assistants" AS a
WHERE c."assistant_id" = a."id";

ALTER TABLE "conversations"
  ALTER COLUMN "tenant_id" SET NOT NULL,
  ALTER COLUMN "workspace_id" SET NOT NULL;

ALTER TABLE "conversations" RENAME COLUMN "user_id" TO "owner_user_id";

DROP INDEX IF EXISTS "conversations_user_id_idx";

CREATE INDEX "conversations_tenant_id_idx" ON "conversations"("tenant_id");
CREATE INDEX "conversations_workspace_id_idx" ON "conversations"("workspace_id");
CREATE INDEX "conversations_owner_user_id_idx" ON "conversations"("owner_user_id");
CREATE INDEX "conversations_archived_at_idx" ON "conversations"("archived_at");
CREATE INDEX "conversations_scope_owner_archived_idx"
  ON "conversations"("tenant_id", "workspace_id", "assistant_id", "owner_user_id", "archived_at");

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_messages"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "workspace_id" UUID,
  ADD COLUMN "assistant_id" UUID,
  ADD COLUMN "agent_run_id" UUID;

UPDATE "conversation_messages" AS m
SET
  "tenant_id" = c."tenant_id",
  "workspace_id" = c."workspace_id",
  "assistant_id" = c."assistant_id"
FROM "conversations" AS c
WHERE m."conversation_id" = c."id";

ALTER TABLE "conversation_messages"
  ALTER COLUMN "tenant_id" SET NOT NULL,
  ALTER COLUMN "workspace_id" SET NOT NULL,
  ALTER COLUMN "assistant_id" SET NOT NULL;

CREATE INDEX "conversation_messages_tenant_id_idx" ON "conversation_messages"("tenant_id");
CREATE INDEX "conversation_messages_workspace_id_idx" ON "conversation_messages"("workspace_id");
CREATE INDEX "conversation_messages_assistant_id_idx" ON "conversation_messages"("assistant_id");
CREATE INDEX "conversation_messages_user_id_idx" ON "conversation_messages"("user_id");
CREATE INDEX "conversation_messages_agent_run_id_idx" ON "conversation_messages"("agent_run_id");
CREATE INDEX "conversation_messages_created_at_idx" ON "conversation_messages"("created_at");

ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversation_messages_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversation_messages_assistant_id_fkey"
    FOREIGN KEY ("assistant_id") REFERENCES "assistants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "conversation_messages_agent_run_id_fkey"
    FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

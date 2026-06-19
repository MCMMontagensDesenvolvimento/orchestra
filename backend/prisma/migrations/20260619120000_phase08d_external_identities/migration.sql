-- CreateTable
CREATE TABLE "external_identities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_tenant_id" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "display_name" TEXT,
    "last_login_at" TIMESTAMP(3),
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_identities_tenant_id_idx" ON "external_identities"("tenant_id");

-- CreateIndex
CREATE INDEX "external_identities_user_id_idx" ON "external_identities"("user_id");

-- CreateIndex
CREATE INDEX "external_identities_email_idx" ON "external_identities"("email");

-- CreateIndex
CREATE INDEX "external_identities_provider_provider_tenant_id_provider_user_id_idx" ON "external_identities"("provider", "provider_tenant_id", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_provider_subject_active_key" ON "external_identities"("provider", "provider_tenant_id", "provider_user_id") WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

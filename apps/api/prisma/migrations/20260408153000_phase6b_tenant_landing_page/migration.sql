-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantLandingPage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "heroCtaText" TEXT,
    "heroCtaHref" TEXT,
    "theme" JSONB,
    "sections" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TenantLandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TenantLandingPage_tenantId_key" ON "TenantLandingPage"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TenantLandingPage_slug_key" ON "TenantLandingPage"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantLandingPage_tenantId_idx" ON "TenantLandingPage"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantLandingPage_slug_idx" ON "TenantLandingPage"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantLandingPage_isPublished_idx" ON "TenantLandingPage"("isPublished");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantLandingPage_tenantId_fkey'
  ) THEN
    ALTER TABLE "TenantLandingPage"
    ADD CONSTRAINT "TenantLandingPage_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

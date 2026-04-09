ALTER TABLE "ProviderProfile"
ADD COLUMN "userId" TEXT,
ADD COLUMN "registryCode" TEXT;

CREATE UNIQUE INDEX "ProviderProfile_userId_key" ON "ProviderProfile"("userId");
CREATE UNIQUE INDEX "ProviderProfile_registryCode_key" ON "ProviderProfile"("registryCode");

ALTER TABLE "ProviderProfile"
ADD CONSTRAINT "ProviderProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

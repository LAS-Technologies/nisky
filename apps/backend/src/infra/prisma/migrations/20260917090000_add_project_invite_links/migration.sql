-- CreateTable
CREATE TABLE "ProjectInviteLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInviteLink_tokenHash_key" ON "ProjectInviteLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ProjectInviteLink_projectId_revokedAt_idx" ON "ProjectInviteLink"("projectId", "revokedAt");

-- CreateIndex
CREATE INDEX "ProjectInviteLink_createdById_idx" ON "ProjectInviteLink"("createdById");

-- AddForeignKey
ALTER TABLE "ProjectInviteLink" ADD CONSTRAINT "ProjectInviteLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInviteLink" ADD CONSTRAINT "ProjectInviteLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

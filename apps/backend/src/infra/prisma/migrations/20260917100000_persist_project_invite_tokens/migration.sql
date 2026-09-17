-- AlterTable
ALTER TABLE "ProjectInviteLink" ADD COLUMN "tokenCipher" TEXT;
ALTER TABLE "ProjectInviteLink" ADD COLUMN "tokenIv" TEXT;
ALTER TABLE "ProjectInviteLink" ADD COLUMN "tokenAuthTag" TEXT;

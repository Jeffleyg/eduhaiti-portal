/*
  Warnings:

  - Changed the type of `action` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "changes" JSONB,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
DROP COLUMN "action",
ADD COLUMN     "action" TEXT NOT NULL;

-- DropEnum
DROP TYPE "AuditAction";

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

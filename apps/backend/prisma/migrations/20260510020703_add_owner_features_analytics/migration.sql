-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "enableFamilyAccess" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableFinance" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableForums" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableGamification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableLessons" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enablePayment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableSync" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SchoolUsageAnalytic" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "totalLogins" INTEGER NOT NULL DEFAULT 0,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "teacherCount" INTEGER NOT NULL DEFAULT 0,
    "classCount" INTEGER NOT NULL DEFAULT 0,
    "gradeCreations" INTEGER NOT NULL DEFAULT 0,
    "attendanceRecords" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "resourcesUploaded" INTEGER NOT NULL DEFAULT 0,
    "assignmentsCreated" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolUsageAnalytic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPermissionCode" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolPermissionCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolUsageAnalytic_schoolId_idx" ON "SchoolUsageAnalytic"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolUsageAnalytic_schoolId_key" ON "SchoolUsageAnalytic"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPermissionCode_code_key" ON "SchoolPermissionCode"("code");

-- CreateIndex
CREATE INDEX "SchoolPermissionCode_schoolId_idx" ON "SchoolPermissionCode"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolPermissionCode_code_idx" ON "SchoolPermissionCode"("code");

-- AddForeignKey
ALTER TABLE "SchoolUsageAnalytic" ADD CONSTRAINT "SchoolUsageAnalytic_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPermissionCode" ADD CONSTRAINT "SchoolPermissionCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

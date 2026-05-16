/*
  Warnings:

  - You are about to drop the column `changes` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entityId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `AuditLog` table. All the data in the column will be lost.
  - The `action` column on the `AuditLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `AuditLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'PUBLISH', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'CONFIG_CHANGE', 'SETTING_UPDATED', 'SETTINGS_INITIALIZED', 'PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSIONS_INITIALIZED', 'TENANT_CREATED', 'TENANT_UPDATED', 'TENANT_DELETED', 'TENANT_LIMITS_UPDATED', 'WHITE_LABEL_UPDATED', 'WRITE');

-- DropIndex
DROP INDEX IF EXISTS "AuditLog_entityType_entityId_idx";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "changes",
DROP COLUMN "entityId",
DROP COLUMN "entityType",
ADD COLUMN     "changesSummary" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "newValues" JSONB,
ADD COLUMN     "oldValues" JSONB,
ADD COLUMN     "resource" TEXT,
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userAgent" TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'AuditLog'
            AND column_name = 'entityType'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'AuditLog'
            AND column_name = 'entityId'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'AuditLog'
            AND column_name = 'changes'
    ) THEN
        EXECUTE '
            UPDATE "AuditLog"
            SET
                "resource" = COALESCE("resource", "entityType"),
                "resourceId" = COALESCE("resourceId", "entityId"),
                "changesSummary" = COALESCE("changesSummary", "changes"),
                "oldValues" = CASE
                    WHEN "changes" IS NULL THEN NULL
                    ELSE jsonb_build_object(''changes'', "changes")
                END';
    END IF;
END $$;

ALTER TABLE "AuditLog"
ADD COLUMN "action_new" "AuditAction";

UPDATE "AuditLog"
SET "action_new" = CASE UPPER(COALESCE("action"::text, ''))
    WHEN 'CREATE' THEN 'CREATE'::"AuditAction"
    WHEN 'READ' THEN 'READ'::"AuditAction"
    WHEN 'UPDATE' THEN 'UPDATE'::"AuditAction"
    WHEN 'DELETE' THEN 'DELETE'::"AuditAction"
    WHEN 'PUBLISH' THEN 'PUBLISH'::"AuditAction"
    WHEN 'APPROVE' THEN 'APPROVE'::"AuditAction"
    WHEN 'REJECT' THEN 'REJECT'::"AuditAction"
    WHEN 'LOGIN' THEN 'LOGIN'::"AuditAction"
    WHEN 'LOGOUT' THEN 'LOGOUT'::"AuditAction"
    WHEN 'CONFIG_CHANGE' THEN 'CONFIG_CHANGE'::"AuditAction"
    WHEN 'SETTING_UPDATED' THEN 'SETTING_UPDATED'::"AuditAction"
    WHEN 'SETTINGS_INITIALIZED' THEN 'SETTINGS_INITIALIZED'::"AuditAction"
    WHEN 'PERMISSION_GRANT' THEN 'PERMISSION_GRANT'::"AuditAction"
    WHEN 'PERMISSION_REVOKE' THEN 'PERMISSION_REVOKE'::"AuditAction"
    WHEN 'PERMISSIONS_INITIALIZED' THEN 'PERMISSIONS_INITIALIZED'::"AuditAction"
    WHEN 'TENANT_CREATED' THEN 'TENANT_CREATED'::"AuditAction"
    WHEN 'TENANT_UPDATED' THEN 'TENANT_UPDATED'::"AuditAction"
    WHEN 'TENANT_DELETED' THEN 'TENANT_DELETED'::"AuditAction"
    WHEN 'TENANT_LIMITS_UPDATED' THEN 'TENANT_LIMITS_UPDATED'::"AuditAction"
    WHEN 'WHITE_LABEL_UPDATED' THEN 'WHITE_LABEL_UPDATED'::"AuditAction"
    WHEN 'WRITE' THEN 'WRITE'::"AuditAction"
    ELSE 'UPDATE'::"AuditAction"
END;

ALTER TABLE "AuditLog"
DROP COLUMN IF EXISTS "action",
DROP COLUMN IF EXISTS "changes",
DROP COLUMN IF EXISTS "entityId",
DROP COLUMN IF EXISTS "entityType";

ALTER TABLE "AuditLog"
RENAME COLUMN "action_new" TO "action";

UPDATE "AuditLog"
SET "resource" = COALESCE("resource", 'AuditLog');

ALTER TABLE "AuditLog"
ALTER COLUMN "resource" SET NOT NULL,
ALTER COLUMN "action" SET NOT NULL;

-- CreateTable
CREATE TABLE "TenantConfiguration" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "maxStudents" INTEGER NOT NULL DEFAULT 1000,
    "maxTeachers" INTEGER NOT NULL DEFAULT 100,
    "maxClasses" INTEGER NOT NULL DEFAULT 50,
    "storageLimitGb" INTEGER NOT NULL DEFAULT 10,
    "maxConcurrentUsers" INTEGER NOT NULL DEFAULT 500,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0F2B5E',
    "secondaryColor" TEXT NOT NULL DEFAULT '#E63946',
    "companyName" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "enableCustomDomain" BOOLEAN NOT NULL DEFAULT false,
    "enableSso" BOOLEAN NOT NULL DEFAULT false,
    "enableAdvancedAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "enableApiAccess" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'basic',
    "billingEmail" TEXT,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "nextBillingDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewayConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "provider" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "secretKeyEncrypted" TEXT,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMetric" (
    "id" TEXT NOT NULL,
    "totalSchools" INTEGER NOT NULL DEFAULT 0,
    "totalActiveStudents" INTEGER NOT NULL DEFAULT 0,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "totalTeachers" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delinquencyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageStudentPerSchool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newSchoolsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "newStudentsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "churnRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemUptime" DOUBLE PRECISION NOT NULL DEFAULT 99.9,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMetricHistory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "studentCount" INTEGER NOT NULL,
    "teacherCount" INTEGER NOT NULL,
    "classCount" INTEGER NOT NULL,
    "enrollmentsCount" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "delinquentCount" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolMetricHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemNotification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "targetRole" TEXT,
    "targetSchools" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expireAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMetric" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "totalStudentsActive" INTEGER NOT NULL DEFAULT 0,
    "totalTeachersActive" INTEGER NOT NULL DEFAULT 0,
    "defaultRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enrollmentGrowthMoM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRevenueCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfiguration_schoolId_key" ON "TenantConfiguration"("schoolId");

-- CreateIndex
CREATE INDEX "TenantConfiguration_schoolId_idx" ON "TenantConfiguration"("schoolId");

-- CreateIndex
CREATE INDEX "RolePermission_schoolId_role_idx" ON "RolePermission"("schoolId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_schoolId_role_resource_key" ON "RolePermission"("schoolId", "role", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSetting_key_key" ON "GlobalSetting"("key");

-- CreateIndex
CREATE INDEX "GlobalSetting_category_idx" ON "GlobalSetting"("category");

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_provider_idx" ON "PaymentGatewayConfig"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayConfig_schoolId_provider_key" ON "PaymentGatewayConfig"("schoolId", "provider");

-- CreateIndex
CREATE INDEX "SchoolMetricHistory_schoolId_idx" ON "SchoolMetricHistory"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolMetricHistory_year_month_idx" ON "SchoolMetricHistory"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMetricHistory_schoolId_year_month_key" ON "SchoolMetricHistory"("schoolId", "year", "month");

-- CreateIndex
CREATE INDEX "TenantMetric_schoolId_idx" ON "TenantMetric"("schoolId");

-- CreateIndex
CREATE INDEX "TenantMetric_recordedAt_idx" ON "TenantMetric"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMetric_schoolId_key" ON "TenantMetric"("schoolId");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_idx" ON "AuditLog"("schoolId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TenantConfiguration" ADD CONSTRAINT "TenantConfiguration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGatewayConfig" ADD CONSTRAINT "PaymentGatewayConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMetricHistory" ADD CONSTRAINT "SchoolMetricHistory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMetric" ADD CONSTRAINT "TenantMetric_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

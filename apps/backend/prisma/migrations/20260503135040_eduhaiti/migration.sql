-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('TEXTBOOK', 'UNIFORM', 'MEAL_KIT', 'DEVICE', 'OTHER');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "guardianId" TEXT;

-- CreateTable
CREATE TABLE "GradeHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "sourceGradeId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" "GradeStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT,
    "relationship" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianStudent" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianOtpChallenge" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolInventoryItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "itemType" "InventoryItemType" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minThreshold" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolInventoryMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolInventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeHistory_studentId_academicYearId_idx" ON "GradeHistory"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "GradeHistory_sourceGradeId_idx" ON "GradeHistory"("sourceGradeId");

-- CreateIndex
CREATE INDEX "Guardian_phoneNumber_idx" ON "Guardian"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_phoneNumber_documentId_key" ON "Guardian"("phoneNumber", "documentId");

-- CreateIndex
CREATE INDEX "GuardianStudent_studentId_idx" ON "GuardianStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianStudent_guardianId_studentId_key" ON "GuardianStudent"("guardianId", "studentId");

-- CreateIndex
CREATE INDEX "GuardianOtpChallenge_guardianId_expiresAt_idx" ON "GuardianOtpChallenge"("guardianId", "expiresAt");

-- CreateIndex
CREATE INDEX "GuardianOtpChallenge_studentId_idx" ON "GuardianOtpChallenge"("studentId");

-- CreateIndex
CREATE INDEX "SchoolInventoryItem_schoolId_itemType_idx" ON "SchoolInventoryItem"("schoolId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolInventoryItem_schoolId_name_sku_key" ON "SchoolInventoryItem"("schoolId", "name", "sku");

-- CreateIndex
CREATE INDEX "SchoolInventoryMovement_itemId_createdAt_idx" ON "SchoolInventoryMovement"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_guardianId_idx" ON "Payment"("guardianId");

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_sourceGradeId_fkey" FOREIGN KEY ("sourceGradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudent" ADD CONSTRAINT "GuardianStudent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudent" ADD CONSTRAINT "GuardianStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianOtpChallenge" ADD CONSTRAINT "GuardianOtpChallenge_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianOtpChallenge" ADD CONSTRAINT "GuardianOtpChallenge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolInventoryItem" ADD CONSTRAINT "SchoolInventoryItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolInventoryMovement" ADD CONSTRAINT "SchoolInventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SchoolInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

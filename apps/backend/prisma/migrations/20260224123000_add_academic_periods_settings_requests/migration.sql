-- CreateEnum
CREATE TYPE "AcademicRequestType" AS ENUM ('ENROLLMENT_LETTER', 'GRADE_REVIEW', 'ABSENCE_JUSTIFICATION', 'PROGRAM_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "AcademicRequestStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AcademicPeriod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicSetting" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "passAverage" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxAbsencesPerCourse" INTEGER NOT NULL DEFAULT 5,
    "assignmentLateDaysLimit" INTEGER NOT NULL DEFAULT 2,
    "gradeReviewWindowDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT,
    "type" "AcademicRequestType" NOT NULL,
    "status" "AcademicRequestStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "reviewedById" TEXT,
    "resolutionComment" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicPeriod_schoolId_name_key" ON "AcademicPeriod"("schoolId", "name");

-- CreateIndex
CREATE INDEX "AcademicPeriod_schoolId_startDate_idx" ON "AcademicPeriod"("schoolId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSetting_schoolId_key" ON "AcademicSetting"("schoolId");

-- CreateIndex
CREATE INDEX "AcademicRequest_studentId_status_idx" ON "AcademicRequest"("studentId", "status");

-- CreateIndex
CREATE INDEX "AcademicRequest_classId_idx" ON "AcademicRequest"("classId");

-- CreateIndex
CREATE INDEX "AcademicRequest_reviewedById_idx" ON "AcademicRequest"("reviewedById");

-- AddForeignKey
ALTER TABLE "AcademicPeriod" ADD CONSTRAINT "AcademicPeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicSetting" ADD CONSTRAINT "AcademicSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicRequest" ADD CONSTRAINT "AcademicRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicRequest" ADD CONSTRAINT "AcademicRequest_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicRequest" ADD CONSTRAINT "AcademicRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

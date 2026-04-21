/*
  Warnings:

  - The `status` column on the `Attendance` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `subject` on the `Grade` table. All the data in the column will be lost.
  - The `status` column on the `Grade` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[academicYearId,seriesId,name]` on the table `Class` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[menfpId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYearId` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seriesId` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicYearId` to the `Grade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `disciplineId` to the `Grade` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "GradeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE', 'GRADED');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('GENERAL', 'ACADEMIC', 'EMERGENCY', 'EVENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_createdById_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentSubmission" DROP CONSTRAINT "AssignmentSubmission_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_classId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_classId_fkey";

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_studentId_fkey";

-- DropIndex
DROP INDEX "Grade_studentId_classId_idx";

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 20,
ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "AssignmentSubmission" ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "remarks" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT';

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "academicYearId" TEXT NOT NULL,
ADD COLUMN     "maxStudents" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "seriesId" TEXT NOT NULL,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Grade" DROP COLUMN "subject",
ADD COLUMN     "academicYearId" TEXT NOT NULL,
ADD COLUMN     "disciplineId" TEXT NOT NULL,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
DROP COLUMN "status",
ADD COLUMN     "status" "GradeStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "menfpId" TEXT;

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'Haiti',
    "logo" TEXT,
    "founded" TIMESTAMP(3),
    "principal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'GENERAL',
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scorecard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "averageScore" DOUBLE PRECISION,
    "passStatus" BOOLEAN NOT NULL DEFAULT false,
    "ranking" INTEGER,
    "observations" TEXT,
    "pdfPath" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "receiptNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

-- CreateIndex
CREATE UNIQUE INDEX "School_email_key" ON "School"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_year_key" ON "AcademicYear"("year");

-- CreateIndex
CREATE INDEX "AcademicYear_schoolId_year_idx" ON "AcademicYear"("schoolId", "year");

-- CreateIndex
CREATE INDEX "Series_academicYearId_idx" ON "Series"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Series_academicYearId_name_key" ON "Series"("academicYearId", "name");

-- CreateIndex
CREATE INDEX "Discipline_seriesId_idx" ON "Discipline"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_seriesId_name_key" ON "Discipline"("seriesId", "name");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_publishedAt_idx" ON "Announcement"("schoolId", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_createdById_idx" ON "Announcement"("createdById");

-- CreateIndex
CREATE INDEX "CalendarEvent_schoolId_startDate_idx" ON "CalendarEvent"("schoolId", "startDate");

-- CreateIndex
CREATE INDEX "Scorecard_studentId_academicYearId_idx" ON "Scorecard"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Scorecard_studentId_academicYearId_semester_key" ON "Scorecard"("studentId", "academicYearId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_schoolId_studentId_dueDate_idx" ON "Payment"("schoolId", "studentId", "dueDate");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Class_academicYearId_idx" ON "Class"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_academicYearId_seriesId_name_key" ON "Class"("academicYearId", "seriesId", "name");

-- CreateIndex
CREATE INDEX "Grade_studentId_classId_disciplineId_idx" ON "Grade"("studentId", "classId", "disciplineId");

-- CreateIndex
CREATE INDEX "Grade_academicYearId_idx" ON "Grade"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "User_menfpId_key" ON "User"("menfpId");

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipline" ADD CONSTRAINT "Discipline_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

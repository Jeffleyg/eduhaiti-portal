/*
  Warnings:

  - A unique constraint covering the columns `[enrollmentNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "enrollmentNumber" TEXT,
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tempPasswordExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_enrollmentNumber_key" ON "User"("enrollmentNumber");

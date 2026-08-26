-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateTable
CREATE TABLE "PixAccount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "keyType" "PixKeyType" NOT NULL,
    "key" TEXT NOT NULL,
    "accountHolderName" TEXT,
    "bankCode" TEXT,
    "accountNumber" TEXT,
    "accountBranch" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PixAccount_schoolId_isActive_idx" ON "PixAccount"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "PixAccount_schoolId_isPrimary_idx" ON "PixAccount"("schoolId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "PixAccount_schoolId_key_key" ON "PixAccount"("schoolId", "key");

-- AddForeignKey
ALTER TABLE "PixAccount" ADD CONSTRAINT "PixAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

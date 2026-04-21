-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_idempotencyKey_key" ON "IdempotencyRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_operation_status_idx" ON "IdempotencyRecord"("operation", "status");

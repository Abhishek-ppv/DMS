-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "entityId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StockTransferRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "sourcePartnerId" TEXT NOT NULL,
    "destinationPartnerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "imeis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReturnRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "sourcePartnerId" TEXT NOT NULL,
    "destinationPartnerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "imeis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTransferRequest_status_idx" ON "StockTransferRequest"("status");

-- CreateIndex
CREATE INDEX "StockTransferRequest_sourcePartnerId_idx" ON "StockTransferRequest"("sourcePartnerId");

-- CreateIndex
CREATE INDEX "StockTransferRequest_destinationPartnerId_idx" ON "StockTransferRequest"("destinationPartnerId");

-- CreateIndex
CREATE INDEX "StockReturnRequest_status_idx" ON "StockReturnRequest"("status");

-- CreateIndex
CREATE INDEX "StockReturnRequest_sourcePartnerId_idx" ON "StockReturnRequest"("sourcePartnerId");

-- CreateIndex
CREATE INDEX "StockReturnRequest_destinationPartnerId_idx" ON "StockReturnRequest"("destinationPartnerId");

-- AddForeignKey
ALTER TABLE "StockTransferRequest" ADD CONSTRAINT "StockTransferRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferRequest" ADD CONSTRAINT "StockTransferRequest_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferRequest" ADD CONSTRAINT "StockTransferRequest_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferRequest" ADD CONSTRAINT "StockTransferRequest_sourcePartnerId_fkey" FOREIGN KEY ("sourcePartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferRequest" ADD CONSTRAINT "StockTransferRequest_destinationPartnerId_fkey" FOREIGN KEY ("destinationPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferRequest" ADD CONSTRAINT "StockTransferRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferRequest" ADD CONSTRAINT "StockTransferRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturnRequest" ADD CONSTRAINT "StockReturnRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturnRequest" ADD CONSTRAINT "StockReturnRequest_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturnRequest" ADD CONSTRAINT "StockReturnRequest_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturnRequest" ADD CONSTRAINT "StockReturnRequest_sourcePartnerId_fkey" FOREIGN KEY ("sourcePartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturnRequest" ADD CONSTRAINT "StockReturnRequest_destinationPartnerId_fkey" FOREIGN KEY ("destinationPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturnRequest" ADD CONSTRAINT "StockReturnRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturnRequest" ADD CONSTRAINT "StockReturnRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

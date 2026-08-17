-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "inventoryItemId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "salesOrderId" TEXT,
ADD COLUMN     "salesOrderLineId" TEXT;

-- CreateIndex
CREATE INDEX "SalesOrderLine_inventoryItemId_idx" ON "SalesOrderLine"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

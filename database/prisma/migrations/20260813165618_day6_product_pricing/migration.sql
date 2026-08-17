-- CreateTable
CREATE TABLE "ProductPricing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "partnerType" "PartnerType" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPricing_productId_idx" ON "ProductPricing"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPricing_productId_partnerType_key" ON "ProductPricing"("productId", "partnerType");

-- AddForeignKey
ALTER TABLE "ProductPricing" ADD CONSTRAINT "ProductPricing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

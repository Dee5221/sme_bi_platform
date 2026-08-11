-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdById" TEXT,
    "saleNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    "notes" TEXT,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "unitPrice" DECIMAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL NOT NULL,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");

-- CreateIndex
CREATE INDEX "Sale_businessId_soldAt_idx" ON "Sale"("businessId", "soldAt");

-- CreateIndex
CREATE INDEX "Sale_businessId_customerId_idx" ON "Sale"("businessId", "customerId");

-- CreateIndex
CREATE INDEX "Sale_businessId_status_idx" ON "Sale"("businessId", "status");

-- CreateIndex
CREATE INDEX "Sale_createdById_idx" ON "Sale"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_businessId_saleNumber_key" ON "Sale"("businessId", "saleNumber");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

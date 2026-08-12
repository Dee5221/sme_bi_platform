-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "accountType" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("businessId", "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "passwordHash", "phone", "updatedAt") SELECT "businessId", "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "passwordHash", "phone", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_customerId_key" ON "User"("customerId");
CREATE UNIQUE INDEX "User_supplierId_key" ON "User"("supplierId");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_businessId_idx" ON "User"("businessId");
CREATE INDEX "User_businessId_isActive_idx" ON "User"("businessId", "isActive");
CREATE INDEX "User_businessId_accountType_idx" ON "User"("businessId", "accountType");
CREATE INDEX "User_customerId_idx" ON "User"("customerId");
CREATE INDEX "User_supplierId_idx" ON "User"("supplierId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

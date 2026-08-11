-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "expenseDate" DATETIME NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExpenseCategory_businessId_idx" ON "ExpenseCategory"("businessId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_businessId_isActive_idx" ON "ExpenseCategory"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_businessId_name_key" ON "ExpenseCategory"("businessId", "name");

-- CreateIndex
CREATE INDEX "Expense_businessId_idx" ON "Expense"("businessId");

-- CreateIndex
CREATE INDEX "Expense_businessId_status_idx" ON "Expense"("businessId", "status");

-- CreateIndex
CREATE INDEX "Expense_businessId_expenseDate_idx" ON "Expense"("businessId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_businessId_categoryId_idx" ON "Expense"("businessId", "categoryId");

-- CreateIndex
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");

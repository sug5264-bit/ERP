-- ============================================================
-- Migration: Add production, OEM, BOM, pricing, and shipper tables
-- Description: 생산관리, OEM 계약, BOM, 단가관리, 3PL 화주사 테이블 추가
-- 모든 명령이 idempotent하여 재실행해도 안전합니다.
-- ============================================================

-- 1. Create missing enums
DO $$ BEGIN CREATE TYPE "OemContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'TERMINATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductionPlanStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Shipper Companies
CREATE TABLE IF NOT EXISTS "shipper_companies" (
    "id" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "bizNo" TEXT,
    "ceoName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "contractStart" DATE,
    "contractEnd" DATE,
    "monthlyFee" DECIMAL(15,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipper_companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shipper_companies_companyCode_key" ON "shipper_companies"("companyCode");
CREATE UNIQUE INDEX IF NOT EXISTS "shipper_companies_bizNo_key" ON "shipper_companies"("bizNo");

-- 3. Shipper Orders
CREATE TABLE IF NOT EXISTS "shipper_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "shipperId" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderPhone" TEXT,
    "senderAddress" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "recipientZipCode" TEXT,
    "recipientAddress" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weight" DECIMAL(10,2),
    "shippingMethod" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "trackingNo" TEXT,
    "carrier" TEXT,
    "shippingCost" DECIMAL(15,2),
    "deliveredAt" TIMESTAMP(3),
    "specialNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipper_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shipper_orders_orderNo_key" ON "shipper_orders"("orderNo");
CREATE INDEX IF NOT EXISTS "shipper_orders_shipperId_idx" ON "shipper_orders"("shipperId");
CREATE INDEX IF NOT EXISTS "shipper_orders_orderDate_idx" ON "shipper_orders"("orderDate");
CREATE INDEX IF NOT EXISTS "shipper_orders_status_idx" ON "shipper_orders"("status");

ALTER TABLE "shipper_orders" DROP CONSTRAINT IF EXISTS "shipper_orders_shipperId_fkey";
ALTER TABLE "shipper_orders" ADD CONSTRAINT "shipper_orders_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Add shipper columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accountType" TEXT NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shipperId" TEXT;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. OEM Contracts
CREATE TABLE IF NOT EXISTS "oem_contracts" (
    "id" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "OemContractStatus" NOT NULL DEFAULT 'DRAFT',
    "minimumOrderQty" DECIMAL(15,2),
    "leadTimeDays" INTEGER,
    "paymentTerms" TEXT,
    "qualityTerms" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "oem_contracts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "oem_contracts_contractNo_key" ON "oem_contracts"("contractNo");
CREATE INDEX IF NOT EXISTS "oem_contracts_partnerId_idx" ON "oem_contracts"("partnerId");
CREATE INDEX IF NOT EXISTS "oem_contracts_status_idx" ON "oem_contracts"("status");

-- 6. BOM Headers
CREATE TABLE IF NOT EXISTS "bom_headers" (
    "id" TEXT NOT NULL,
    "bomCode" TEXT NOT NULL,
    "bomName" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "yieldRate" DECIMAL(8,4) NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bom_headers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bom_headers_bomCode_key" ON "bom_headers"("bomCode");
CREATE INDEX IF NOT EXISTS "bom_headers_itemId_idx" ON "bom_headers"("itemId");

-- 7. BOM Details
CREATE TABLE IF NOT EXISTS "bom_details" (
    "id" TEXT NOT NULL,
    "bomHeaderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "lossRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "remark" TEXT,
    CONSTRAINT "bom_details_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bom_details_bomHeaderId_lineNo_key" ON "bom_details"("bomHeaderId", "lineNo");
CREATE INDEX IF NOT EXISTS "bom_details_itemId_idx" ON "bom_details"("itemId");

ALTER TABLE "bom_details" DROP CONSTRAINT IF EXISTS "bom_details_bomHeaderId_fkey";
ALTER TABLE "bom_details" ADD CONSTRAINT "bom_details_bomHeaderId_fkey" FOREIGN KEY ("bomHeaderId") REFERENCES "bom_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Production Plans
CREATE TABLE IF NOT EXISTS "production_plans" (
    "id" TEXT NOT NULL,
    "planNo" TEXT NOT NULL,
    "planDate" DATE NOT NULL,
    "bomHeaderId" TEXT NOT NULL,
    "oemContractId" TEXT,
    "plannedQty" DECIMAL(15,2) NOT NULL,
    "plannedDate" DATE NOT NULL,
    "completionDate" DATE,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "production_plans_planNo_key" ON "production_plans"("planNo");
CREATE INDEX IF NOT EXISTS "production_plans_planDate_idx" ON "production_plans"("planDate");
CREATE INDEX IF NOT EXISTS "production_plans_status_idx" ON "production_plans"("status");
CREATE INDEX IF NOT EXISTS "production_plans_oemContractId_idx" ON "production_plans"("oemContractId");

ALTER TABLE "production_plans" DROP CONSTRAINT IF EXISTS "production_plans_bomHeaderId_fkey";
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_bomHeaderId_fkey" FOREIGN KEY ("bomHeaderId") REFERENCES "bom_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_plans" DROP CONSTRAINT IF EXISTS "production_plans_oemContractId_fkey";
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_oemContractId_fkey" FOREIGN KEY ("oemContractId") REFERENCES "oem_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. Production Results
CREATE TABLE IF NOT EXISTS "production_results" (
    "id" TEXT NOT NULL,
    "resultNo" TEXT NOT NULL,
    "productionPlanId" TEXT NOT NULL,
    "productionDate" DATE NOT NULL,
    "producedQty" DECIMAL(15,2) NOT NULL,
    "defectQty" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "goodQty" DECIMAL(15,2) NOT NULL,
    "lotNo" TEXT,
    "expiryDate" DATE,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "production_results_resultNo_key" ON "production_results"("resultNo");
CREATE INDEX IF NOT EXISTS "production_results_productionPlanId_idx" ON "production_results"("productionPlanId");
CREATE INDEX IF NOT EXISTS "production_results_productionDate_idx" ON "production_results"("productionDate");
CREATE INDEX IF NOT EXISTS "production_results_lotNo_idx" ON "production_results"("lotNo");

ALTER TABLE "production_results" DROP CONSTRAINT IF EXISTS "production_results_productionPlanId_fkey";
ALTER TABLE "production_results" ADD CONSTRAINT "production_results_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "production_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10. Sales Prices
CREATE TABLE IF NOT EXISTS "sales_prices" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "minQty" DECIMAL(15,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_prices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sales_prices_partnerId_itemId_startDate_key" ON "sales_prices"("partnerId", "itemId", "startDate");
CREATE INDEX IF NOT EXISTS "sales_prices_partnerId_idx" ON "sales_prices"("partnerId");
CREATE INDEX IF NOT EXISTS "sales_prices_itemId_idx" ON "sales_prices"("itemId");
CREATE INDEX IF NOT EXISTS "sales_prices_isActive_idx" ON "sales_prices"("isActive");

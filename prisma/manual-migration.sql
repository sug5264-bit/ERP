-- ============================================================
-- Manual DB Migration Script
-- Prisma 스키마와 실제 DB를 동기화하기 위한 SQL
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- ─── 새 Enum 타입 ────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "ReturnReason" AS ENUM ('DEFECT', 'WRONG_ITEM', 'CUSTOMER_CHANGE', 'QUALITY_ISSUE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "QualityGrade" AS ENUM ('A', 'B', 'C', 'REJECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── sales_orders: partnerId를 nullable로 변경 ──────────────

ALTER TABLE "sales_orders" ALTER COLUMN "partnerId" DROP NOT NULL;

-- ─── sales_orders: 새 컬럼 추가 ─────────────────────────────

ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "vatIncluded" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "dispatchInfo" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "siteName" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "ordererName" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "ordererContact" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "recipientContact" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "recipientZipCode" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "recipientAddress" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "requirements" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "senderName" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "senderPhone" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "senderAddress" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "shippingCost" DECIMAL(15, 2);
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "trackingNo" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "specialNote" TEXT;

-- sales_orders 인덱스
CREATE INDEX IF NOT EXISTS "sales_orders_status_salesChannel_idx" ON "sales_orders"("status", "salesChannel");

-- ─── deliveries: 새 컬럼 추가 ───────────────────────────────

ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "qualityStatus" TEXT;
CREATE INDEX IF NOT EXISTS "deliveries_qualityStatus_idx" ON "deliveries"("qualityStatus");

-- ─── purchase_orders: 새 컬럼 추가 ──────────────────────────

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "dispatchInfo" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "vatIncluded" BOOLEAN NOT NULL DEFAULT true;

-- ─── notes 테이블 ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "notes" (
  "id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "relatedTable" TEXT NOT NULL,
  "relatedId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notes_relatedTable_relatedId_idx" ON "notes"("relatedTable", "relatedId");

-- ─── companies 테이블 ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "companies" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "bizNo" TEXT,
  "ceoName" TEXT,
  "bizType" TEXT,
  "bizCategory" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "fax" TEXT,
  "email" TEXT,
  "bankName" TEXT,
  "bankAccount" TEXT,
  "bankHolder" TEXT,
  "bankCopyPath" TEXT,
  "bizCertPath" TEXT,
  "logoPath" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "companies_bizNo_key" ON "companies"("bizNo");

-- ─── sales_returns 테이블 ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sales_returns" (
  "id" TEXT NOT NULL,
  "returnNo" TEXT NOT NULL,
  "returnDate" DATE NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "reason" "ReturnReason" NOT NULL DEFAULT 'OTHER',
  "reasonDetail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "totalAmount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "processedBy" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sales_returns_returnNo_key" ON "sales_returns"("returnNo");
CREATE INDEX IF NOT EXISTS "sales_returns_returnDate_idx" ON "sales_returns"("returnDate");
CREATE INDEX IF NOT EXISTS "sales_returns_status_idx" ON "sales_returns"("status");

ALTER TABLE "sales_returns" DROP CONSTRAINT IF EXISTS "sales_returns_salesOrderId_fkey";
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_returns" DROP CONSTRAINT IF EXISTS "sales_returns_partnerId_fkey";
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── sales_return_details 테이블 ─────────────────────────────

CREATE TABLE IF NOT EXISTS "sales_return_details" (
  "id" TEXT NOT NULL,
  "salesReturnId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" DECIMAL(15, 2) NOT NULL,
  "unitPrice" DECIMAL(15, 2) NOT NULL,
  "amount" DECIMAL(15, 2) NOT NULL,
  "remark" TEXT,
  CONSTRAINT "sales_return_details_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sales_return_details_salesReturnId_idx" ON "sales_return_details"("salesReturnId");

ALTER TABLE "sales_return_details" DROP CONSTRAINT IF EXISTS "sales_return_details_salesReturnId_fkey";
ALTER TABLE "sales_return_details" ADD CONSTRAINT "sales_return_details_salesReturnId_fkey"
  FOREIGN KEY ("salesReturnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_return_details" DROP CONSTRAINT IF EXISTS "sales_return_details_itemId_fkey";
ALTER TABLE "sales_return_details" ADD CONSTRAINT "sales_return_details_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── quality_standards 테이블 ────────────────────────────────

CREATE TABLE IF NOT EXISTS "quality_standards" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "standardName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "checkMethod" TEXT,
  "spec" TEXT,
  "minValue" DECIMAL(15, 4),
  "maxValue" DECIMAL(15, 4),
  "unit" TEXT,
  "isCritical" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quality_standards_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quality_standards_itemId_idx" ON "quality_standards"("itemId");
CREATE INDEX IF NOT EXISTS "quality_standards_category_idx" ON "quality_standards"("category");

ALTER TABLE "quality_standards" DROP CONSTRAINT IF EXISTS "quality_standards_itemId_fkey";
ALTER TABLE "quality_standards" ADD CONSTRAINT "quality_standards_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── quality_inspections 테이블 ──────────────────────────────

CREATE TABLE IF NOT EXISTS "quality_inspections" (
  "id" TEXT NOT NULL,
  "inspectionNo" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "inspectionDate" DATE NOT NULL,
  "inspectorName" TEXT NOT NULL,
  "overallGrade" "QualityGrade" NOT NULL DEFAULT 'A',
  "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
  "defectCount" INTEGER NOT NULL DEFAULT 0,
  "defectRate" DECIMAL(8, 4) NOT NULL DEFAULT 0,
  "lotNo" TEXT,
  "judgement" TEXT NOT NULL DEFAULT 'PASS',
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quality_inspections_inspectionNo_key" ON "quality_inspections"("inspectionNo");
CREATE INDEX IF NOT EXISTS "quality_inspections_deliveryId_idx" ON "quality_inspections"("deliveryId");
CREATE INDEX IF NOT EXISTS "quality_inspections_inspectionDate_idx" ON "quality_inspections"("inspectionDate");
CREATE INDEX IF NOT EXISTS "quality_inspections_overallGrade_idx" ON "quality_inspections"("overallGrade");
CREATE INDEX IF NOT EXISTS "quality_inspections_judgement_idx" ON "quality_inspections"("judgement");

ALTER TABLE "quality_inspections" DROP CONSTRAINT IF EXISTS "quality_inspections_deliveryId_fkey";
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── quality_inspection_items 테이블 ─────────────────────────

CREATE TABLE IF NOT EXISTS "quality_inspection_items" (
  "id" TEXT NOT NULL,
  "qualityInspectionId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "checkItem" TEXT NOT NULL,
  "spec" TEXT,
  "measuredValue" TEXT,
  "result" TEXT NOT NULL DEFAULT 'PASS',
  "grade" "QualityGrade" NOT NULL DEFAULT 'A',
  "defectType" TEXT,
  "remarks" TEXT,
  CONSTRAINT "quality_inspection_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quality_inspection_items_qualityInspectionId_idx" ON "quality_inspection_items"("qualityInspectionId");

ALTER TABLE "quality_inspection_items" DROP CONSTRAINT IF EXISTS "quality_inspection_items_qualityInspectionId_fkey";
ALTER TABLE "quality_inspection_items" ADD CONSTRAINT "quality_inspection_items_qualityInspectionId_fkey"
  FOREIGN KEY ("qualityInspectionId") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 완료 ────────────────────────────────────────────────────
-- 이 스크립트를 Supabase Dashboard > SQL Editor에서 실행하세요.
-- 실행 후 Vercel에서 재배포하면 모든 기능이 정상 작동합니다.

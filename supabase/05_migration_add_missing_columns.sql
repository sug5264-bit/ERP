-- ============================================================
-- 05_migration_add_missing_columns.sql
-- Prisma 스키마에 정의되었으나 DB에 누락된 13개 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. items 테이블: 식품 유통 관련 5개 컬럼
ALTER TABLE items ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS "originCountry" TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS "storageTemp" TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS "shelfLifeDays" INTEGER;
ALTER TABLE items ADD COLUMN IF NOT EXISTS "allergens" TEXT;

-- 2. warehouses 테이블: 저장 유형 (상온/냉장/냉동)
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS "storageType" TEXT NOT NULL DEFAULT 'AMBIENT';

-- 3. stock_balances 테이블: LOT/유통기한 추적
ALTER TABLE stock_balances ADD COLUMN IF NOT EXISTS "lotNo" TEXT;
ALTER TABLE stock_balances ADD COLUMN IF NOT EXISTS "expiryDate" DATE;

-- 4. partners 테이블: 식품 사업자 관련 정보
ALTER TABLE partners ADD COLUMN IF NOT EXISTS "foodBizNo" TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS "haccpNo" TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS "factoryAddress" TEXT;

-- 5. deliveries 테이블: 출하완료 정보
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "completedBy" TEXT;

-- ============================================================
-- 인덱스 추가 (성능 최적화)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_stock_balances_lot ON stock_balances ("lotNo");
CREATE INDEX IF NOT EXISTS idx_stock_balances_expiry ON stock_balances ("expiryDate");
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_sales_order_details_item_remaining ON sales_order_details ("itemId", "remainingQty");
CREATE INDEX IF NOT EXISTS idx_employee_histories_emp_date ON employee_histories ("employeeId", "effectiveDate");
CREATE INDEX IF NOT EXISTS idx_recruitments_status ON recruitments ("status");

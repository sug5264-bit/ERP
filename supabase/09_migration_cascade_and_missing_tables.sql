-- ============================================================================
-- Migration 09: CASCADE 정책 동기화 + 누락 테이블 생성
-- ============================================================================
-- Prisma 스키마와 DB 외래키 정책을 동기화합니다.
--   1. RESTRICT → CASCADE 변경 (부모 삭제 시 자식도 함께 삭제되어야 하는 관계)
--   2. 누락된 테이블 5개 생성 (shipper_rates, shipper_items, shipper_inventory,
--      shipper_sales, sales_revenue_details)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. RESTRICT → CASCADE 변경
-- ---------------------------------------------------------------------------

-- 직원 관련 (직원 삭제 시 이력/급여/근태/휴가도 삭제)
ALTER TABLE "employee_histories" DROP CONSTRAINT IF EXISTS "employee_histories_employeeId_fkey";
ALTER TABLE "employee_histories" ADD CONSTRAINT "employee_histories_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_details" DROP CONSTRAINT IF EXISTS "payroll_details_payrollHeaderId_fkey";
ALTER TABLE "payroll_details" ADD CONSTRAINT "payroll_details_payrollHeaderId_fkey"
  FOREIGN KEY ("payrollHeaderId") REFERENCES "payroll_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_details" DROP CONSTRAINT IF EXISTS "payroll_details_employeeId_fkey";
ALTER TABLE "payroll_details" ADD CONSTRAINT "payroll_details_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_employeeId_fkey";
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "leaves_employeeId_fkey";
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_balances" DROP CONSTRAINT IF EXISTS "leave_balances_employeeId_fkey";
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 채용 지원자 (채용 공고 삭제 시 지원자도 삭제)
ALTER TABLE "applicants" DROP CONSTRAINT IF EXISTS "applicants_recruitmentId_fkey";
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_recruitmentId_fkey"
  FOREIGN KEY ("recruitmentId") REFERENCES "recruitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 창고 구역 (창고 삭제 시 구역도 삭제)
ALTER TABLE "warehouse_zones" DROP CONSTRAINT IF EXISTS "warehouse_zones_warehouseId_fkey";
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 게시판/메시지 (사용자/게시판 삭제 시 관련 데이터도 삭제)
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_boardId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_authorId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_comments" DROP CONSTRAINT IF EXISTS "post_comments_authorId_fkey";
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_senderId_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_receiverId_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey"
  FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 생산 실적 (생산 계획 삭제 시 실적도 삭제)
ALTER TABLE "production_results" DROP CONSTRAINT IF EXISTS "production_results_productionPlanId_fkey";
ALTER TABLE "production_results" ADD CONSTRAINT "production_results_productionPlanId_fkey"
  FOREIGN KEY ("productionPlanId") REFERENCES "production_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 화주사 주문 (화주사 삭제 시 주문도 삭제)
ALTER TABLE "shipper_orders" DROP CONSTRAINT IF EXISTS "shipper_orders_shipperId_fkey";
ALTER TABLE "shipper_orders" ADD CONSTRAINT "shipper_orders_shipperId_fkey"
  FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. 누락 테이블 생성
-- ---------------------------------------------------------------------------

-- 2-1. 화주사 요율 테이블
CREATE TABLE IF NOT EXISTS "shipper_rates" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shipperId"      TEXT NOT NULL,
  "rateName"       TEXT NOT NULL,
  "regionCode"     TEXT,
  "regionName"     TEXT,
  "weightMin"      DECIMAL(10,2),
  "weightMax"      DECIMAL(10,2),
  "baseRate"       DECIMAL(15,2) NOT NULL,
  "surchargeRate"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "shippingMethod" TEXT NOT NULL DEFAULT 'NORMAL',
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom"  DATE,
  "effectiveTo"    DATE,
  "memo"           TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "shipper_rates_shipperId_fkey"
    FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shipper_rates_shipper ON "shipper_rates"("shipperId");
CREATE INDEX IF NOT EXISTS idx_shipper_rates_region ON "shipper_rates"("regionCode");
CREATE INDEX IF NOT EXISTS idx_shipper_rates_method ON "shipper_rates"("shippingMethod");

-- 2-2. 화주사 품목 테이블
CREATE TABLE IF NOT EXISTS "shipper_items" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shipperId"     TEXT NOT NULL,
  "itemCode"      TEXT NOT NULL,
  "itemName"      TEXT NOT NULL,
  "barcode"       TEXT,
  "category"      TEXT,
  "weight"        DECIMAL(10,2),
  "width"         DECIMAL(10,2),
  "height"        DECIMAL(10,2),
  "depth"         DECIMAL(10,2),
  "storageTemp"   TEXT NOT NULL DEFAULT 'AMBIENT',
  "shelfLifeDays" INT,
  "unitPrice"     DECIMAL(15,2),
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "memo"          TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "shipper_items_shipperId_fkey"
    FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shipper_items_shipperId_itemCode_key"
    UNIQUE ("shipperId", "itemCode")
);

CREATE INDEX IF NOT EXISTS idx_shipper_items_shipper ON "shipper_items"("shipperId");
CREATE INDEX IF NOT EXISTS idx_shipper_items_name ON "shipper_items"("itemName");
CREATE INDEX IF NOT EXISTS idx_shipper_items_barcode ON "shipper_items"("barcode");

-- 2-3. 화주사 위탁 재고 테이블
CREATE TABLE IF NOT EXISTS "shipper_inventory" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shipperId"     TEXT NOT NULL,
  "shipperItemId" TEXT NOT NULL,
  "warehouseId"   TEXT,
  "zoneName"      TEXT,
  "quantity"      INT NOT NULL DEFAULT 0,
  "lotNo"         TEXT,
  "expiryDate"    DATE,
  "inboundDate"   DATE,
  "memo"          TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "shipper_inventory_shipperItemId_fkey"
    FOREIGN KEY ("shipperItemId") REFERENCES "shipper_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shipper_inventory_shipper ON "shipper_inventory"("shipperId");
CREATE INDEX IF NOT EXISTS idx_shipper_inventory_item ON "shipper_inventory"("shipperItemId");
CREATE INDEX IF NOT EXISTS idx_shipper_inventory_expiry ON "shipper_inventory"("expiryDate");

-- 2-4. 화주사 매출 테이블
CREATE TABLE IF NOT EXISTS "shipper_sales" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shipperId"    TEXT NOT NULL,
  "salesDate"    DATE NOT NULL,
  "salesChannel" TEXT,
  "customerName" TEXT,
  "itemName"     TEXT NOT NULL,
  "quantity"     INT NOT NULL DEFAULT 1,
  "unitPrice"    DECIMAL(15,2) NOT NULL,
  "totalAmount"  DECIMAL(15,2) NOT NULL,
  "memo"         TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "shipper_sales_shipperId_fkey"
    FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shipper_sales_shipper ON "shipper_sales"("shipperId");
CREATE INDEX IF NOT EXISTS idx_shipper_sales_date ON "shipper_sales"("salesDate");
CREATE INDEX IF NOT EXISTS idx_shipper_sales_channel ON "shipper_sales"("salesChannel");

-- 2-5. 매출 품목 상세 테이블 (온라인 매출 연동)
CREATE TABLE IF NOT EXISTS "sales_revenue_details" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "revenueId" TEXT NOT NULL,
  "itemId"    TEXT NOT NULL,
  "quantity"  INT NOT NULL,
  "unitPrice" DECIMAL(15,2) NOT NULL,
  "amount"    DECIMAL(15,2) NOT NULL,

  CONSTRAINT "sales_revenue_details_revenueId_fkey"
    FOREIGN KEY ("revenueId") REFERENCES "online_sales_revenues"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sales_revenue_details_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sales_revenue_details_revenue ON "sales_revenue_details"("revenueId");
CREATE INDEX IF NOT EXISTS idx_sales_revenue_details_item ON "sales_revenue_details"("itemId");

-- ---------------------------------------------------------------------------
-- 3. 신규 테이블에도 RLS 적용
-- ---------------------------------------------------------------------------
ALTER TABLE "shipper_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipper_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipper_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipper_sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_revenue_details" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['shipper_rates','shipper_items','shipper_inventory','shipper_sales','sales_revenue_details']
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "service_role_all" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. shipper_orders에 shipperItemId FK 추가 (Prisma 스키마에서 참조)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipper_orders' AND column_name = 'shipperItemId'
  ) THEN
    ALTER TABLE "shipper_orders" ADD COLUMN "shipperItemId" TEXT;
    ALTER TABLE "shipper_orders" ADD CONSTRAINT "shipper_orders_shipperItemId_fkey"
      FOREIGN KEY ("shipperItemId") REFERENCES "shipper_items"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_shipper_orders_item ON "shipper_orders"("shipperItemId");
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 웰그린 ERP - DB 강화 통합 마이그레이션
-- ============================================================================
-- Supabase SQL Editor에 통째로 붙여넣고 Run 하면 됩니다.
-- 여러 번 실행해도 안전합니다 (모든 구문이 IF NOT EXISTS / DROP IF EXISTS).
--
-- 포함 내용:
--   PART 1. 누락 테이블 5개 생성
--   PART 2. CASCADE 외래키 동기화 (RESTRICT → CASCADE 15건)
--   PART 3. 성능 인덱스 (30명 환경 최적화)
--   PART 4. RLS 전체 활성화 + service_role 정책
--   PART 5. 자동 정리 함수 (login_attempts, audit_logs)
--   PART 6. Storage 버킷 RLS 정책
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 1. 누락 테이블 생성                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 1-1. 화주사 요율
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

-- 1-2. 화주사 품목
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

-- 1-3. 화주사 위탁 재고
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

-- 1-4. 화주사 매출
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

-- 1-5. 매출 품목 상세
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


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 2. CASCADE 외래키 동기화 (RESTRICT → CASCADE)                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- DROP IF EXISTS + ADD 패턴이라 이미 CASCADE여도 안전합니다.

-- 직원 → 이력
ALTER TABLE "employee_histories" DROP CONSTRAINT IF EXISTS "employee_histories_employeeId_fkey";
ALTER TABLE "employee_histories" ADD CONSTRAINT "employee_histories_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 급여 상세 → 급여 헤더
ALTER TABLE "payroll_details" DROP CONSTRAINT IF EXISTS "payroll_details_payrollHeaderId_fkey";
ALTER TABLE "payroll_details" ADD CONSTRAINT "payroll_details_payrollHeaderId_fkey"
  FOREIGN KEY ("payrollHeaderId") REFERENCES "payroll_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 급여 상세 → 직원
ALTER TABLE "payroll_details" DROP CONSTRAINT IF EXISTS "payroll_details_employeeId_fkey";
ALTER TABLE "payroll_details" ADD CONSTRAINT "payroll_details_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 근태 → 직원
ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_employeeId_fkey";
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 휴가 → 직원
ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "leaves_employeeId_fkey";
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 휴가 잔여일 → 직원
ALTER TABLE "leave_balances" DROP CONSTRAINT IF EXISTS "leave_balances_employeeId_fkey";
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 지원자 → 채용공고
ALTER TABLE "applicants" DROP CONSTRAINT IF EXISTS "applicants_recruitmentId_fkey";
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_recruitmentId_fkey"
  FOREIGN KEY ("recruitmentId") REFERENCES "recruitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 창고 구역 → 창고
ALTER TABLE "warehouse_zones" DROP CONSTRAINT IF EXISTS "warehouse_zones_warehouseId_fkey";
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 게시글 → 게시판
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_boardId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 게시글 → 작성자
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_authorId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 댓글 → 작성자
ALTER TABLE "post_comments" DROP CONSTRAINT IF EXISTS "post_comments_authorId_fkey";
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 메시지 → 보낸사람
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_senderId_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 메시지 → 받는사람
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_receiverId_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey"
  FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 생산 실적 → 생산 계획
ALTER TABLE "production_results" DROP CONSTRAINT IF EXISTS "production_results_productionPlanId_fkey";
ALTER TABLE "production_results" ADD CONSTRAINT "production_results_productionPlanId_fkey"
  FOREIGN KEY ("productionPlanId") REFERENCES "production_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 화주사 주문 → 화주사
ALTER TABLE "shipper_orders" DROP CONSTRAINT IF EXISTS "shipper_orders_shipperId_fkey";
ALTER TABLE "shipper_orders" ADD CONSTRAINT "shipper_orders_shipperId_fkey"
  FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 3. 성능 인덱스                                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users("isActive");
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users("accountType");
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users("createdAt");
CREATE INDEX IF NOT EXISTS idx_employees_join_date ON employees("joinDate");
CREATE INDEX IF NOT EXISTS idx_employees_dept_status ON employees("departmentId", status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status_created ON sales_orders(status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_employee ON sales_orders("employeeId");
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_created ON purchase_orders(status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_stock_balances_item_wh ON stock_balances("itemId", "warehouseId");
CREATE INDEX IF NOT EXISTS idx_deliveries_status_date ON deliveries(status, "deliveryDate" DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_status_created ON vouchers(status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_leaves_employee_status ON leaves("employeeId", status);
CREATE INDEX IF NOT EXISTS idx_approval_docs_drafter ON approval_documents("drafterId");
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications("userId", "isRead");
CREATE INDEX IF NOT EXISTS idx_items_active_type ON items("isActive", "itemType");
CREATE INDEX IF NOT EXISTS idx_shipper_orders_shipper_date ON shipper_orders("shipperId", "orderDate" DESC);
CREATE INDEX IF NOT EXISTS idx_shipper_orders_status ON shipper_orders(status);

-- 신규 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_shipper_rates_shipper ON "shipper_rates"("shipperId");
CREATE INDEX IF NOT EXISTS idx_shipper_rates_region ON "shipper_rates"("regionCode");
CREATE INDEX IF NOT EXISTS idx_shipper_rates_method ON "shipper_rates"("shippingMethod");
CREATE INDEX IF NOT EXISTS idx_shipper_items_shipper ON "shipper_items"("shipperId");
CREATE INDEX IF NOT EXISTS idx_shipper_items_name ON "shipper_items"("itemName");
CREATE INDEX IF NOT EXISTS idx_shipper_items_barcode ON "shipper_items"("barcode");
CREATE INDEX IF NOT EXISTS idx_shipper_inventory_shipper ON "shipper_inventory"("shipperId");
CREATE INDEX IF NOT EXISTS idx_shipper_inventory_item ON "shipper_inventory"("shipperItemId");
CREATE INDEX IF NOT EXISTS idx_shipper_inventory_expiry ON "shipper_inventory"("expiryDate");
CREATE INDEX IF NOT EXISTS idx_shipper_sales_shipper ON "shipper_sales"("shipperId");
CREATE INDEX IF NOT EXISTS idx_shipper_sales_date ON "shipper_sales"("salesDate");
CREATE INDEX IF NOT EXISTS idx_shipper_sales_channel ON "shipper_sales"("salesChannel");
CREATE INDEX IF NOT EXISTS idx_sales_revenue_details_revenue ON "sales_revenue_details"("revenueId");
CREATE INDEX IF NOT EXISTS idx_sales_revenue_details_item ON "sales_revenue_details"("itemId");


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 4. RLS 전체 활성화 + service_role 정책                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "service_role_all" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl.tablename
    );
  END LOOP;
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 5. 자동 정리 함수                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 로그인 시도 정리 (30일 보관)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM login_attempts WHERE "createdAt" < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 감사 로그 정리 (일반 90일, LOGIN 180일 보관)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE "createdAt" < NOW() - INTERVAL '90 days'
    AND action != 'LOGIN';
  DELETE FROM audit_logs
  WHERE "createdAt" < NOW() - INTERVAL '180 days'
    AND action = 'LOGIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 6. Storage 버킷 RLS 정책                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    BEGIN
      CREATE POLICY "auth_upload" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id IN ('upload', 'upload2'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      CREATE POLICY "auth_read" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id IN ('upload', 'upload2'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      CREATE POLICY "service_delete" ON storage.objects
        FOR DELETE TO service_role
        USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 7. shipper_orders 컬럼 추가 (Prisma 스키마 동기화)                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

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


-- ============================================================================
-- 완료! 모든 구문이 IF NOT EXISTS / DROP IF EXISTS 패턴이라
-- 다시 실행해도 에러 없이 안전합니다.
-- ============================================================================

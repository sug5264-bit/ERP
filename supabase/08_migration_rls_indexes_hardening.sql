-- ============================================================================
-- Migration 08: RLS Policies, Performance Indexes & Security Hardening
-- ============================================================================
-- This migration hardens the database by:
--   1. Enabling Row Level Security (RLS) on ALL public tables and granting
--      full access to the service_role (used by the backend).
--   2. Adding performance indexes tailored for a 30-user environment to
--      speed up common queries on orders, employees, stock, deliveries, etc.
--   3. Creating cleanup functions for login_attempts (30-day retention) and
--      audit_logs (90-day general / 180-day LOGIN action retention).
--   4. Setting up storage bucket RLS policies for authenticated uploads and
--      service_role deletions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS and add service_role policy for all tables
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Performance indexes for 30-user environment
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Auto-cleanup functions
-- ---------------------------------------------------------------------------

-- Auto-cleanup function for old login attempts (30 days)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM login_attempts WHERE "createdAt" < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup for old audit logs (90 days, keep LOGIN actions for 180 days)
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

-- ---------------------------------------------------------------------------
-- 4. Storage bucket RLS policies
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Create storage policies for authenticated uploads
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

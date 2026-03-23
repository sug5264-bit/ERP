-- ============================================================
-- Migration 10: Security & Schema Fixes
-- ============================================================

-- 1. Add missing FK constraint on shipper_inventory.shipperId
ALTER TABLE "shipper_inventory"
  DROP CONSTRAINT IF EXISTS "shipper_inventory_shipperId_fkey";
ALTER TABLE "shipper_inventory"
  ADD CONSTRAINT "shipper_inventory_shipperId_fkey"
  FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Fix TIMESTAMP(3) → TIMESTAMPTZ on legacy tables from migration 04
-- shipper_companies
ALTER TABLE "shipper_companies"
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';

-- shipper_orders
ALTER TABLE "shipper_orders"
  ALTER COLUMN "deliveredAt" SET DATA TYPE TIMESTAMPTZ USING "deliveredAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ USING "updatedAt" AT TIME ZONE 'UTC';

-- 3. Ensure RLS is enabled on online_sales_revenues (idempotent)
ALTER TABLE "online_sales_revenues" ENABLE ROW LEVEL SECURITY;

-- Create service_role policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'online_sales_revenues' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON "online_sales_revenues" FOR ALL TO service_role USING (true);
  END IF;
END $$;

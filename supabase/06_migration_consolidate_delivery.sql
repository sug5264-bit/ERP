-- Migration: Consolidate order/shipment management into deliveries
-- Adds order tracking fields, online revenue fields to deliveries table
-- Creates online_sales_revenues table for bulk revenue entry

-- Add order tracking fields to deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "orderConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "orderConfirmedAt" TIMESTAMP;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "shipmentCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "shipmentCompletedAt" TIMESTAMP;

-- Add online revenue fields to deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "actualRevenue" DECIMAL(15,2);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "platformFee" DECIMAL(15,2);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS "revenueNote" TEXT;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_deliveries_order_confirmed ON deliveries ("orderConfirmed");
CREATE INDEX IF NOT EXISTS idx_deliveries_shipment_completed ON deliveries ("shipmentCompleted");

-- Create online_sales_revenues table for bulk revenue entry
CREATE TABLE IF NOT EXISTS online_sales_revenues (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "revenueDate" DATE NOT NULL,
  channel VARCHAR(50) NOT NULL,
  description TEXT,
  "totalSales" DECIMAL(15,2) NOT NULL,
  "totalFee" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "netRevenue" DECIMAL(15,2) NOT NULL,
  "orderCount" INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_online_sales_revenues_date ON online_sales_revenues ("revenueDate");
CREATE INDEX IF NOT EXISTS idx_online_sales_revenues_channel ON online_sales_revenues (channel);
CREATE INDEX IF NOT EXISTS idx_online_sales_revenues_date_channel ON online_sales_revenues ("revenueDate", channel);

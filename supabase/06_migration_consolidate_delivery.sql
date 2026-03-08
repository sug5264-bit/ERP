-- Migration: Consolidate order/shipment management into deliveries
-- Adds order tracking fields, online revenue fields to deliveries table
-- Creates online_sales_revenues table for bulk revenue entry

-- Add order tracking fields to deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS order_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS order_confirmed_at TIMESTAMP;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS shipment_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS shipment_completed_at TIMESTAMP;

-- Add online revenue fields to deliveries
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS actual_revenue DECIMAL(15,2);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(15,2);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS revenue_note TEXT;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_deliveries_order_confirmed ON deliveries (order_confirmed);
CREATE INDEX IF NOT EXISTS idx_deliveries_shipment_completed ON deliveries (shipment_completed);

-- Create online_sales_revenues table for bulk revenue entry
CREATE TABLE IF NOT EXISTS online_sales_revenues (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  revenue_date DATE NOT NULL,
  channel VARCHAR(50) NOT NULL,
  description TEXT,
  total_sales DECIMAL(15,2) NOT NULL,
  total_fee DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_revenue DECIMAL(15,2) NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_online_sales_revenues_date ON online_sales_revenues (revenue_date);
CREATE INDEX IF NOT EXISTS idx_online_sales_revenues_channel ON online_sales_revenues (channel);
CREATE INDEX IF NOT EXISTS idx_online_sales_revenues_date_channel ON online_sales_revenues (revenue_date, channel);

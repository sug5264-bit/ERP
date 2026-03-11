#!/usr/bin/env node
/**
 * DB 스키마 동기화 스크립트
 *
 * prisma db push가 실패할 경우 fallback으로 실행됩니다.
 * Prisma 스키마에 정의된 컬럼이 실제 DB에 없으면 자동 추가합니다.
 *
 * 사용법: node scripts/db-sync.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** 컬럼 존재 여부 확인 */
async function columnExists(table, column) {
  const result = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    table,
    column
  )
  return result.length > 0
}

/** 테이블 존재 여부 확인 */
async function tableExists(table) {
  const result = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public'`,
    table
  )
  return result.length > 0
}

/** 누락된 컬럼 추가 */
async function addColumnIfMissing(table, column, definition) {
  if (await columnExists(table, column)) return false
  console.log(`  + Adding column: ${table}.${column}`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`)
  return true
}

async function main() {
  console.log('[db-sync] Checking database schema...')
  let changeCount = 0

  // ── companies 테이블 ──
  if (!(await tableExists('companies'))) {
    console.log('  + Creating table: companies')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "companies" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyName" TEXT NOT NULL,
        "bizNo" TEXT UNIQUE,
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
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── sales_orders: 누락 컬럼 ──
  const salesOrderColumns = [
    ['vatIncluded', 'BOOLEAN NOT NULL DEFAULT true'],
    ['dispatchInfo', 'TEXT'],
    ['receivedBy', 'TEXT'],
    ['siteName', 'TEXT'],
    ['ordererName', 'TEXT'],
    ['recipientName', 'TEXT'],
    ['ordererContact', 'TEXT'],
    ['recipientContact', 'TEXT'],
    ['recipientZipCode', 'TEXT'],
    ['recipientAddress', 'TEXT'],
    ['requirements', 'TEXT'],
    ['senderName', 'TEXT'],
    ['senderPhone', 'TEXT'],
    ['senderAddress', 'TEXT'],
    ['shippingCost', 'DECIMAL(15,2)'],
    ['trackingNo', 'TEXT'],
    ['specialNote', 'TEXT'],
  ]

  for (const [col, def] of salesOrderColumns) {
    if (await addColumnIfMissing('sales_orders', col, def)) changeCount++
  }

  // partnerId nullable 처리
  try {
    const partnerCol = await prisma.$queryRawUnsafe(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'sales_orders' AND column_name = 'partnerId'`
    )
    if (partnerCol.length > 0 && partnerCol[0].is_nullable === 'NO') {
      console.log('  ~ Making sales_orders.partnerId nullable')
      await prisma.$executeRawUnsafe(`ALTER TABLE "sales_orders" ALTER COLUMN "partnerId" DROP NOT NULL`)
      changeCount++
    }
  } catch { /* column may not exist yet */ }

  // ── purchase_orders: 누락 컬럼 ──
  const purchaseOrderColumns = [
    ['dispatchInfo', 'TEXT'],
    ['receivedBy', 'TEXT'],
    ['vatIncluded', 'BOOLEAN NOT NULL DEFAULT true'],
  ]
  for (const [col, def] of purchaseOrderColumns) {
    if (await addColumnIfMissing('purchase_orders', col, def)) changeCount++
  }

  // ── deliveries: qualityStatus ──
  if (await addColumnIfMissing('deliveries', 'qualityStatus', 'TEXT')) changeCount++

  // ── notes 테이블 ──
  if (!(await tableExists('notes'))) {
    console.log('  + Creating table: notes')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "notes" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "content" TEXT NOT NULL,
        "relatedTable" TEXT NOT NULL,
        "relatedId" TEXT NOT NULL,
        "createdBy" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX "notes_relatedTable_relatedId_idx" ON "notes"("relatedTable", "relatedId")`)
    changeCount++
  }

  // ── sales_returns 테이블 ──
  if (!(await tableExists('sales_returns'))) {
    console.log('  + Creating table: sales_returns')
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "ReturnReason" AS ENUM ('DEFECT','WRONG_ITEM','CUSTOMER_CHANGE','QUALITY_ISSUE','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "sales_returns" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "returnNo" TEXT NOT NULL UNIQUE,
        "returnDate" DATE NOT NULL,
        "salesOrderId" TEXT NOT NULL REFERENCES "sales_orders"("id") ON DELETE RESTRICT,
        "partnerId" TEXT NOT NULL REFERENCES "partners"("id") ON DELETE RESTRICT,
        "reason" "ReturnReason" NOT NULL DEFAULT 'OTHER',
        "reasonDetail" TEXT,
        "status" TEXT NOT NULL DEFAULT 'REQUESTED',
        "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
        "processedBy" TEXT,
        "processedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── sales_return_details 테이블 ──
  if (!(await tableExists('sales_return_details'))) {
    console.log('  + Creating table: sales_return_details')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "sales_return_details" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "salesReturnId" TEXT NOT NULL REFERENCES "sales_returns"("id") ON DELETE CASCADE,
        "itemId" TEXT NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
        "quantity" DECIMAL(15,2) NOT NULL,
        "unitPrice" DECIMAL(15,2) NOT NULL,
        "amount" DECIMAL(15,2) NOT NULL,
        "remark" TEXT
      )
    `)
    changeCount++
  }

  // ── quality_standards 테이블 ──
  if (!(await tableExists('quality_standards'))) {
    console.log('  + Creating table: quality_standards')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "quality_standards" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "itemId" TEXT NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
        "standardName" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "checkMethod" TEXT,
        "spec" TEXT,
        "minValue" DECIMAL(15,4),
        "maxValue" DECIMAL(15,4),
        "unit" TEXT,
        "isCritical" BOOLEAN NOT NULL DEFAULT false,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── quality_inspections 테이블 ──
  if (!(await tableExists('quality_inspections'))) {
    console.log('  + Creating table: quality_inspections')
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "QualityGrade" AS ENUM ('A','B','C','REJECT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "InspectionStatus" AS ENUM ('PENDING','IN_PROGRESS','COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "quality_inspections" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "inspectionNo" TEXT NOT NULL UNIQUE,
        "deliveryId" TEXT NOT NULL REFERENCES "deliveries"("id") ON DELETE RESTRICT,
        "inspectionDate" DATE NOT NULL,
        "inspectorName" TEXT NOT NULL,
        "overallGrade" "QualityGrade" NOT NULL DEFAULT 'A',
        "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
        "sampleSize" INTEGER NOT NULL DEFAULT 0,
        "defectCount" INTEGER NOT NULL DEFAULT 0,
        "defectRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
        "lotNo" TEXT,
        "judgement" TEXT NOT NULL DEFAULT 'PASS',
        "remarks" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── quality_inspection_items 테이블 ──
  if (!(await tableExists('quality_inspection_items'))) {
    console.log('  + Creating table: quality_inspection_items')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "quality_inspection_items" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "qualityInspectionId" TEXT NOT NULL REFERENCES "quality_inspections"("id") ON DELETE CASCADE,
        "category" TEXT NOT NULL,
        "checkItem" TEXT NOT NULL,
        "spec" TEXT,
        "measuredValue" TEXT,
        "result" TEXT NOT NULL DEFAULT 'PASS',
        "grade" "QualityGrade" NOT NULL DEFAULT 'A',
        "defectType" TEXT,
        "remarks" TEXT
      )
    `)
    changeCount++
  }

  // ── OemContractStatus enum ──
  try {
    await prisma.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "OemContractStatus" AS ENUM ('DRAFT','ACTIVE','SUSPENDED','TERMINATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "ProductionPlanStatus" AS ENUM ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
  } catch { /* enums may already exist */ }

  // ── shipper_companies 테이블 ──
  if (!(await tableExists('shipper_companies'))) {
    console.log('  + Creating table: shipper_companies')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "shipper_companies" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "companyCode" TEXT NOT NULL UNIQUE,
        "companyName" TEXT NOT NULL,
        "bizNo" TEXT UNIQUE,
        "ceoName" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "address" TEXT,
        "contractStart" DATE,
        "contractEnd" DATE,
        "monthlyFee" DECIMAL(15,2),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── shipper_orders 테이블 ──
  if (!(await tableExists('shipper_orders'))) {
    console.log('  + Creating table: shipper_orders')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "shipper_orders" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orderNo" TEXT NOT NULL UNIQUE,
        "shipperId" TEXT NOT NULL REFERENCES "shipper_companies"("id"),
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
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── users: shipper 관련 컬럼 ──
  if (await addColumnIfMissing('users', 'accountType', "TEXT NOT NULL DEFAULT 'INTERNAL'")) changeCount++
  if (await addColumnIfMissing('users', 'shipperId', 'TEXT')) changeCount++

  // ── oem_contracts 테이블 ──
  if (!(await tableExists('oem_contracts'))) {
    console.log('  + Creating table: oem_contracts')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "oem_contracts" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "contractNo" TEXT NOT NULL UNIQUE,
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
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── bom_headers 테이블 ──
  if (!(await tableExists('bom_headers'))) {
    console.log('  + Creating table: bom_headers')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "bom_headers" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "bomCode" TEXT NOT NULL UNIQUE,
        "bomName" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 1,
        "yieldRate" DECIMAL(8,4) NOT NULL DEFAULT 100,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── bom_details 테이블 ──
  if (!(await tableExists('bom_details'))) {
    console.log('  + Creating table: bom_details')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "bom_details" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "bomHeaderId" TEXT NOT NULL REFERENCES "bom_headers"("id") ON DELETE CASCADE,
        "lineNo" INTEGER NOT NULL,
        "itemId" TEXT NOT NULL,
        "quantity" DECIMAL(15,4) NOT NULL,
        "unit" TEXT NOT NULL DEFAULT 'EA',
        "lossRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
        "remark" TEXT,
        UNIQUE("bomHeaderId", "lineNo")
      )
    `)
    changeCount++
  }

  // ── production_plans 테이블 ──
  if (!(await tableExists('production_plans'))) {
    console.log('  + Creating table: production_plans')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "production_plans" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "planNo" TEXT NOT NULL UNIQUE,
        "planDate" DATE NOT NULL,
        "bomHeaderId" TEXT NOT NULL REFERENCES "bom_headers"("id"),
        "oemContractId" TEXT REFERENCES "oem_contracts"("id"),
        "plannedQty" DECIMAL(15,2) NOT NULL,
        "plannedDate" DATE NOT NULL,
        "completionDate" DATE,
        "status" "ProductionPlanStatus" NOT NULL DEFAULT 'PLANNED',
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `)
    changeCount++
  }

  // ── production_results 테이블 ──
  if (!(await tableExists('production_results'))) {
    console.log('  + Creating table: production_results')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "production_results" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "resultNo" TEXT NOT NULL UNIQUE,
        "productionPlanId" TEXT NOT NULL REFERENCES "production_plans"("id"),
        "productionDate" DATE NOT NULL,
        "producedQty" DECIMAL(15,2) NOT NULL,
        "defectQty" DECIMAL(15,2) NOT NULL DEFAULT 0,
        "goodQty" DECIMAL(15,2) NOT NULL,
        "lotNo" TEXT,
        "expiryDate" DATE,
        "remarks" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    changeCount++
  }

  // ── sales_prices 테이블 ──
  if (!(await tableExists('sales_prices'))) {
    console.log('  + Creating table: sales_prices')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "sales_prices" (
        "id" TEXT NOT NULL PRIMARY KEY,
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
        UNIQUE("partnerId", "itemId", "startDate")
      )
    `)
    changeCount++
  }

  // ── online_sales_revenues: salesType 컬럼 ──
  if (await tableExists('online_sales_revenues')) {
    if (await addColumnIfMissing('online_sales_revenues', 'salesType', `TEXT NOT NULL DEFAULT 'ONLINE'`)) changeCount++
  }

  // ── sales_revenue_details 테이블 ──
  if (!(await tableExists('sales_revenue_details'))) {
    console.log('  + Creating table: sales_revenue_details')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "sales_revenue_details" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "revenueId" TEXT NOT NULL REFERENCES "online_sales_revenues"("id") ON DELETE CASCADE,
        "itemId" TEXT NOT NULL REFERENCES "items"("id"),
        "quantity" INTEGER NOT NULL,
        "unitPrice" DECIMAL(15,2) NOT NULL,
        "amount" DECIMAL(15,2) NOT NULL
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX "sales_revenue_details_revenueId_idx" ON "sales_revenue_details"("revenueId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX "sales_revenue_details_itemId_idx" ON "sales_revenue_details"("itemId")`)
    changeCount++
  }

  if (changeCount === 0) {
    console.log('[db-sync] Schema is up to date. No changes needed.')
  } else {
    console.log(`[db-sync] Applied ${changeCount} schema change(s).`)
  }

  await prisma.$disconnect()

  // 스키마 동기화 후 시드 데이터도 확인/적용
  try {
    await import('./db-seed-sync.mjs')
  } catch {
    // db-seed-sync.mjs는 자체적으로 main()을 실행하므로 import만 하면 됨
  }
}

main().catch((e) => {
  console.error('[db-sync] Error:', e.message)
  process.exit(1)
})

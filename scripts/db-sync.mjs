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

  if (changeCount === 0) {
    console.log('[db-sync] Schema is up to date. No changes needed.')
  } else {
    console.log(`[db-sync] Applied ${changeCount} schema change(s).`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[db-sync] Error:', e.message)
  process.exit(1)
})

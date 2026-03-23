/**
 * 모듈간 자동 연동 서비스
 *
 * 수주/출하/구매 등에서 새로운 품목이나 거래처가 입력되면
 * 자동으로 품목관리/거래처관리에 데이터를 생성해주는 유틸리티.
 */
import { prisma } from '@/lib/prisma'
import { generateDocumentNumber } from '@/lib/doc-number'
import { format } from 'date-fns'
import { logger } from '@/lib/logger'

// Prisma 트랜잭션 클라이언트 타입
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Prisma unique constraint violation code */
const PRISMA_UNIQUE_VIOLATION = 'P2002'

function isPrismaUniqueError(error: unknown): boolean {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: unknown }).code === PRISMA_UNIQUE_VIOLATION
  )
}

// ─── 품목 자동 생성 ──────────────────────────────

export interface AutoItemInput {
  /** 기존 품목 ID (있으면 그대로 사용) */
  itemId?: string | null
  /** 품목코드 (새 품목 생성 시 사용, 없으면 자동생성) */
  itemCode?: string | null
  /** 품목명 (새 품목 생성 시 필수) */
  itemName?: string | null
  /** 규격 */
  specification?: string | null
  /** 단위 */
  unit?: string | null
  /** 기본단가 */
  standardPrice?: number | null
  /** 바코드 */
  barcode?: string | null
  /** 품목유형 */
  itemType?: 'GOODS' | 'PRODUCT' | 'RAW_MATERIAL' | 'SUBSIDIARY' | null
  /** 과세유형 */
  taxType?: 'TAXABLE' | 'TAX_FREE' | 'ZERO_RATE' | null
}

/**
 * 품목이 존재하는지 확인하고, 없으면 자동 생성.
 * - itemId가 있고 DB에 존재하면 → 해당 ID 반환
 * - itemId가 있고 DB에 없으면 → itemName이 있으면 자동 생성
 * - itemId가 없고 itemName이 있으면 → 동일 이름 품목 검색 후 없으면 자동 생성
 *
 * 동시성 보호: unique constraint 위반 시 기존 레코드를 다시 조회하여 반환
 *
 * @returns 품목 ID
 */
export async function ensureItemExists(input: AutoItemInput, tx?: TransactionClient): Promise<string> {
  const client = tx || prisma

  // 1. itemId가 있으면 먼저 DB에서 찾기
  if (input.itemId) {
    const existing = await client.item.findUnique({
      where: { id: input.itemId },
      select: { id: true },
    })
    if (existing) return existing.id
  }

  // 2. itemName으로 기존 품목 검색
  if (input.itemName) {
    const byName = await client.item.findFirst({
      where: { itemName: input.itemName },
      select: { id: true },
    })
    if (byName) return byName.id
  }

  // 3. itemCode로 기존 품목 검색
  if (input.itemCode) {
    const byCode = await client.item.findUnique({
      where: { itemCode: input.itemCode },
      select: { id: true },
    })
    if (byCode) return byCode.id
  }

  // 4. barcode로 기존 품목 검색
  if (input.barcode) {
    const byBarcode = await client.item.findFirst({
      where: { barcode: input.barcode },
      select: { id: true },
    })
    if (byBarcode) return byBarcode.id
  }

  // 5. 자동 생성 (itemName이 있어야 함)
  if (!input.itemName) {
    throw new Error(`품목 ID "${input.itemId}"를 찾을 수 없고, 자동 생성을 위한 품목명이 없습니다.`)
  }

  const itemCode = input.itemCode || (await generateAutoCode('ITEM', client))
  try {
    const newItem = await client.item.create({
      data: {
        itemCode,
        itemName: input.itemName,
        specification: input.specification || null,
        unit: input.unit || 'EA',
        standardPrice: input.standardPrice || 0,
        barcode: input.barcode || null,
        itemType: input.itemType || 'GOODS',
        taxType: input.taxType || 'TAXABLE',
        isActive: true,
      },
    })
    return newItem.id
  } catch (error) {
    // 동시 생성으로 인한 unique 위반 시, 기존 레코드 재조회
    if (isPrismaUniqueError(error)) {
      logger.warn('품목 자동 생성 중 중복 감지, 기존 레코드 조회', { itemCode, itemName: input.itemName })
      const existing = await client.item.findFirst({
        where: {
          OR: [{ itemCode }, { itemName: input.itemName }, ...(input.barcode ? [{ barcode: input.barcode }] : [])],
        },
        select: { id: true },
      })
      if (existing) return existing.id
    }
    throw error
  }
}

/**
 * 원자적 자동 코드 생성: DocumentSequence 테이블을 활용하여 race condition 방지.
 * ITEM → AUTO-YYYYMM-XXXXX
 * PARTNER → PTN-YYYYMM-XXXXX
 */
async function generateAutoCode(type: 'ITEM' | 'PARTNER', client: TransactionClient | typeof prisma): Promise<string> {
  const prefixMap = { ITEM: 'AUTO', PARTNER: 'PTN' }
  const seqPrefix = prefixMap[type]
  const yearMonth = format(new Date(), 'yyyyMM')

  const sequence = await client.documentSequence.upsert({
    where: {
      prefix_yearMonth: { prefix: seqPrefix, yearMonth },
    },
    update: {
      lastSeq: { increment: 1 },
    },
    create: {
      prefix: seqPrefix,
      yearMonth,
      lastSeq: 1,
    },
  })

  if (sequence.lastSeq > 99999) {
    throw new Error(`자동 코드 시퀀스 초과: ${seqPrefix}-${yearMonth} (최대 99999)`)
  }

  return `${seqPrefix}-${yearMonth}-${String(sequence.lastSeq).padStart(5, '0')}`
}

// ─── 거래처 자동 생성 ──────────────────────────────

export interface AutoPartnerInput {
  /** 기존 거래처 ID (있으면 그대로 사용) */
  partnerId?: string | null
  /** 거래처코드 (새 거래처 생성 시 사용, 없으면 자동생성) */
  partnerCode?: string | null
  /** 거래처명 (새 거래처 생성 시 필수) */
  partnerName?: string | null
  /** 거래처유형 */
  partnerType?: 'SALES' | 'PURCHASE' | 'BOTH' | null
  /** 사업자번호 */
  bizNo?: string | null
  /** 대표자명 */
  ceoName?: string | null
  /** 전화번호 */
  phone?: string | null
  /** 주소 */
  address?: string | null
}

/**
 * 거래처가 존재하는지 확인하고, 없으면 자동 생성.
 *
 * 동시성 보호: unique constraint 위반 시 기존 레코드를 다시 조회하여 반환
 *
 * @returns 거래처 ID 또는 null (입력이 모두 없는 경우)
 */
export async function ensurePartnerExists(input: AutoPartnerInput, tx?: TransactionClient): Promise<string | null> {
  const client = tx || prisma

  // 입력이 모두 없으면 null 반환
  if (!input.partnerId && !input.partnerName && !input.partnerCode && !input.bizNo) {
    return null
  }

  // 1. partnerId가 있으면 먼저 DB에서 찾기
  if (input.partnerId) {
    const existing = await client.partner.findUnique({
      where: { id: input.partnerId },
      select: { id: true },
    })
    if (existing) return existing.id
  }

  // 2. partnerName으로 기존 거래처 검색
  if (input.partnerName) {
    const byName = await client.partner.findFirst({
      where: { partnerName: input.partnerName },
      select: { id: true },
    })
    if (byName) return byName.id
  }

  // 3. partnerCode로 기존 거래처 검색
  if (input.partnerCode) {
    const byCode = await client.partner.findUnique({
      where: { partnerCode: input.partnerCode },
      select: { id: true },
    })
    if (byCode) return byCode.id
  }

  // 4. bizNo로 기존 거래처 검색
  if (input.bizNo) {
    const byBizNo = await client.partner.findFirst({
      where: { bizNo: input.bizNo },
      select: { id: true },
    })
    if (byBizNo) return byBizNo.id
  }

  // 5. 자동 생성 (partnerName이 있어야 함)
  if (!input.partnerName) {
    throw new Error(`거래처 ID "${input.partnerId}"를 찾을 수 없고, 자동 생성을 위한 거래처명이 없습니다.`)
  }

  const partnerCode = input.partnerCode || (await generateAutoCode('PARTNER', client))
  try {
    const newPartner = await client.partner.create({
      data: {
        partnerCode,
        partnerName: input.partnerName,
        partnerType: input.partnerType || 'BOTH',
        bizNo: input.bizNo || null,
        ceoName: input.ceoName || null,
        phone: input.phone || null,
        address: input.address || null,
        isActive: true,
      },
    })
    return newPartner.id
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      logger.warn('거래처 자동 생성 중 중복 감지, 기존 레코드 조회', { partnerCode, partnerName: input.partnerName })
      const existing = await client.partner.findFirst({
        where: {
          OR: [{ partnerCode }, { partnerName: input.partnerName }, ...(input.bizNo ? [{ bizNo: input.bizNo }] : [])],
        },
        select: { id: true },
      })
      if (existing) return existing.id
    }
    throw error
  }
}

// ─── 재고이동 자동 생성 ──────────────────────────────

export interface AutoStockMovementInput {
  movementType: 'INBOUND' | 'OUTBOUND'
  relatedDocType: string
  relatedDocId: string
  movementDate: Date
  details: Array<{
    itemId: string
    quantity: number
    unitPrice?: number
    lotNo?: string | null
    expiryDate?: Date | null
  }>
  createdBy: string
  warehouseId?: string | null
}

/**
 * 재고이동을 자동으로 생성하고, 재고잔량도 함께 업데이트.
 */
export async function createAutoStockMovement(input: AutoStockMovementInput, tx: TransactionClient): Promise<string> {
  if (!input.details || input.details.length === 0) {
    throw new Error('재고이동 상세 항목이 비어있습니다.')
  }

  const prefix = 'SM'
  const movementNo = await generateDocumentNumber(prefix, input.movementDate, tx)

  const movement = await tx.stockMovement.create({
    data: {
      movementNo,
      movementDate: input.movementDate,
      movementType: input.movementType,
      relatedDocType: input.relatedDocType,
      relatedDocId: input.relatedDocId,
      createdBy: input.createdBy,
      details: {
        create: input.details.map((d) => ({
          itemId: d.itemId,
          quantity: d.quantity,
          unitPrice: d.unitPrice || 0,
          amount: Math.round(d.quantity * (d.unitPrice || 0)),
          lotNo: d.lotNo || null,
          expiryDate: d.expiryDate || null,
        })),
      },
    },
  })

  // 재고잔량 업데이트
  for (const d of input.details) {
    if (input.movementType === 'INBOUND') {
      await ensureStockBalanceInbound(tx, d.itemId, d.quantity, d.unitPrice || 0, input.warehouseId)
    }
    // OUTBOUND는 이미 deliveries route에서 처리 중이므로 여기서는 INBOUND만
  }

  return movement.id
}

/**
 * 입고 시 재고잔량 증가. 기존 재고가 있으면 해당 창고에, 없으면 기본 창고에 생성.
 */
async function ensureStockBalanceInbound(
  tx: TransactionClient,
  itemId: string,
  quantity: number,
  unitPrice: number,
  warehouseId?: string | null
): Promise<void> {
  if (warehouseId) {
    // 지정 창고에 재고 upsert (zoneId=null 기준으로 조회)
    const existing = await tx.stockBalance.findFirst({
      where: { itemId, warehouseId, zoneId: null },
    })
    if (existing) {
      await tx.stockBalance.update({
        where: { id: existing.id },
        data: { quantity: { increment: quantity }, lastMovementDate: new Date() },
      })
    } else {
      await tx.stockBalance.create({
        data: {
          itemId,
          warehouseId,
          quantity,
          averageCost: unitPrice,
          lastMovementDate: new Date(),
        },
      })
    }
    return
  }

  // 기존 재고가 있는 창고에 입고
  const existingBalance = await tx.stockBalance.findFirst({
    where: { itemId },
    orderBy: { lastMovementDate: 'desc' },
  })

  if (existingBalance) {
    await tx.stockBalance.update({
      where: { id: existingBalance.id },
      data: { quantity: { increment: quantity }, lastMovementDate: new Date() },
    })
  } else {
    // 재고 기록이 없으면 기본 창고에 생성
    const defaultWarehouse = await tx.warehouse.findFirst({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    })
    if (defaultWarehouse) {
      await tx.stockBalance.create({
        data: {
          itemId,
          warehouseId: defaultWarehouse.id,
          quantity,
          averageCost: unitPrice,
          lastMovementDate: new Date(),
        },
      })
    } else {
      const { logger } = await import('@/lib/logger')
      logger.error('No active warehouse found for stock balance creation', { itemId, quantity })
    }
  }
}

// ─── 복수 품목 일괄 자동 생성 ──────────────────────────────

export interface AutoItemDetailInput extends AutoItemInput {
  quantity: number
  unitPrice: number
  remark?: string | null
}

/**
 * 주문/견적 상세의 품목들을 일괄로 확인/생성하고, itemId가 확정된 상세 목록을 반환.
 */
export async function resolveItemDetails(
  details: AutoItemDetailInput[],
  tx: TransactionClient
): Promise<Array<{ itemId: string; quantity: number; unitPrice: number; remark?: string | null }>> {
  const resolved = []
  for (const d of details) {
    const itemId = await ensureItemExists(d, tx)
    resolved.push({
      itemId,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
      remark: d.remark || null,
    })
  }
  return resolved
}

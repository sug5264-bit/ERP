import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse('업로드할 데이터가 없습니다.', 'EMPTY_DATA')
    }

    if (rows.length > 500) {
      return errorResponse('한 번에 최대 500건까지 업로드할 수 있습니다.', 'TOO_LARGE', 413)
    }

    let success = 0
    let failed = 0
    const errors: { row: number; message: string }[] = []

    // 배치 중복 검사: N+1 쿼리 제거 (N번 → 3번)
    const allCodes = rows
      .filter((r: Record<string, unknown>) => r.itemCode)
      .map((r: Record<string, unknown>) => String(r.itemCode))
    const allBarcodes = rows
      .filter((r: Record<string, unknown>) => r.barcode)
      .map((r: Record<string, unknown>) => String(r.barcode))
    const allCategoryNames = [
      ...new Set(
        rows
          .filter((r: Record<string, unknown>) => r.categoryName)
          .map((r: Record<string, unknown>) => String(r.categoryName).trim())
      ),
    ]

    const [existingItems, existingBarcodes, categories] = await Promise.all([
      prisma.item.findMany({ where: { itemCode: { in: allCodes } }, select: { itemCode: true } }),
      allBarcodes.length > 0
        ? prisma.item.findMany({ where: { barcode: { in: allBarcodes } }, select: { barcode: true } })
        : Promise.resolve([]),
      allCategoryNames.length > 0
        ? prisma.itemCategory.findMany({ where: { name: { in: allCategoryNames } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ])
    const existingCodeSet = new Set(existingItems.map((i) => i.itemCode))
    const existingBarcodeSet = new Set(existingBarcodes.map((i) => i.barcode))
    const categoryMap = new Map(categories.map((c) => [c.name, c.id]))

    const itemTypeMap: Record<string, string> = {
      상품: 'GOODS',
      제품: 'PRODUCT',
      원자재: 'RAW_MATERIAL',
      부자재: 'SUBSIDIARY',
    }

    const taxTypeMap: Record<string, string> = {
      과세: 'TAXABLE',
      면세: 'TAX_FREE',
      영세: 'ZERO_RATE',
    }
    const VALID_TAX_TYPES = new Set(['TAXABLE', 'TAX_FREE', 'ZERO_RATE'])

    /** 콤마 포함 숫자 문자열을 파싱 */
    function parseNumber(val: unknown): number {
      if (typeof val === 'number') return val
      const parsed = parseFloat(String(val).replace(/,/g, ''))
      return Number.isFinite(parsed) ? parsed : NaN
    }

    const ITEM_CODE_RE = /^[A-Za-z0-9-]{1,50}$/
    const VALID_TYPES = new Set(['GOODS', 'PRODUCT', 'RAW_MATERIAL', 'SUBSIDIARY'])

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>
      const rowNum = i + 2
      try {
        if (!row.itemCode || !row.itemName) {
          throw new Error('품목코드와 품목명은 필수입니다.')
        }

        const itemCode = String(row.itemCode).trim()
        if (!ITEM_CODE_RE.test(itemCode)) {
          throw new Error('품목코드는 영문, 숫자, 하이픈만 사용 가능합니다 (최대 50자).')
        }

        const itemName = String(row.itemName).trim()
        if (itemName.length > 200) {
          throw new Error('품목명은 200자 이내여야 합니다.')
        }

        // 가격 검증
        if (row.standardPrice !== undefined && row.standardPrice !== '') {
          const price = parseNumber(row.standardPrice)
          if (isNaN(price) || price < 0) {
            throw new Error('표준단가는 0 이상의 숫자여야 합니다.')
          }
        }

        // 안전재고 검증
        if (row.safetyStock !== undefined && row.safetyStock !== '') {
          const stock = parseNumber(row.safetyStock)
          if (isNaN(stock) || stock < 0) {
            throw new Error('안전재고는 0 이상의 정수여야 합니다.')
          }
        }

        // 품목유형 검증
        const rawItemType = String(row.itemType || '')
        const mappedType = itemTypeMap[rawItemType] || rawItemType || 'GOODS'
        if (!VALID_TYPES.has(mappedType)) {
          throw new Error(`유효하지 않은 품목유형입니다: ${rawItemType}`)
        }

        // 과세유형 검증
        const rawTaxType = String(row.taxType || '')
        const mappedTaxType = taxTypeMap[rawTaxType] || rawTaxType || 'TAXABLE'
        if (!VALID_TAX_TYPES.has(mappedTaxType)) {
          throw new Error(`유효하지 않은 과세유형입니다: ${rawTaxType}`)
        }

        if (existingCodeSet.has(itemCode)) {
          throw new Error(`품목코드 '${itemCode}'가 이미 존재합니다.`)
        }

        if (row.barcode && existingBarcodeSet.has(String(row.barcode))) {
          throw new Error(`바코드 '${row.barcode}'가 이미 존재합니다.`)
        }

        // 분류(카테고리) 처리 — 배치 조회된 Map에서 조회 (N+1 해결)
        let categoryId: string | undefined
        if (row.categoryName) {
          const catName = String(row.categoryName).trim()
          categoryId = categoryMap.get(catName)
        }

        await prisma.item.create({
          data: {
            itemCode,
            itemName,
            specification: row.specification ? String(row.specification).slice(0, 500) : undefined,
            unit: row.unit ? String(row.unit).trim().slice(0, 20) : 'EA',
            standardPrice: row.standardPrice ? parseNumber(row.standardPrice) : 0,
            safetyStock: row.safetyStock ? Math.floor(parseNumber(row.safetyStock)) : 0,
            itemType: mappedType as 'GOODS' | 'PRODUCT' | 'RAW_MATERIAL' | 'SUBSIDIARY',
            taxType: mappedTaxType as 'TAXABLE' | 'TAX_FREE' | 'ZERO_RATE',
            barcode: row.barcode ? String(row.barcode).trim() : undefined,
            categoryId,
          },
        })
        existingCodeSet.add(itemCode)
        if (row.barcode) existingBarcodeSet.add(String(row.barcode))
        success++
      } catch (err: unknown) {
        failed++
        errors.push({ row: rowNum, message: err instanceof Error ? err.message : '알 수 없는 오류' })
      }
    }

    return successResponse({ success, failed, errors })
  } catch (error) {
    return handleApiError(error)
  }
}

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

    let success = 0
    let failed = 0
    const errors: { row: number; message: string }[] = []

    // 배치 중복 검사: N+1 쿼리 제거 (N번 → 2번)
    const allCodes = rows.filter((r: any) => r.itemCode).map((r: any) => String(r.itemCode))
    const allBarcodes = rows.filter((r: any) => r.barcode).map((r: any) => String(r.barcode))
    const [existingItems, existingBarcodes] = await Promise.all([
      prisma.item.findMany({ where: { itemCode: { in: allCodes } }, select: { itemCode: true } }),
      allBarcodes.length > 0
        ? prisma.item.findMany({ where: { barcode: { in: allBarcodes } }, select: { barcode: true } })
        : Promise.resolve([]),
    ])
    const existingCodeSet = new Set(existingItems.map((i) => i.itemCode))
    const existingBarcodeSet = new Set(existingBarcodes.map((i) => i.barcode))

    const itemTypeMap: Record<string, string> = {
      상품: 'GOODS',
      제품: 'PRODUCT',
      원자재: 'RAW_MATERIAL',
      반제품: 'SEMI_PRODUCT',
      부자재: 'SUB_MATERIAL',
    }

    if (rows.length > 500) {
      return errorResponse('한 번에 최대 500건까지 업로드할 수 있습니다.', 'TOO_LARGE', 413)
    }

    const ITEM_CODE_RE = /^[A-Za-z0-9-]{1,50}$/
    const VALID_TYPES = new Set(['GOODS', 'PRODUCT', 'RAW_MATERIAL', 'SEMI_PRODUCT', 'SUB_MATERIAL', 'SUBSIDIARY'])

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
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
        if (row.standardPrice !== undefined) {
          const price = parseFloat(row.standardPrice)
          if (isNaN(price) || price < 0) {
            throw new Error('표준단가는 0 이상의 숫자여야 합니다.')
          }
        }

        // 안전재고 검증
        if (row.safetyStock !== undefined) {
          const stock = parseInt(row.safetyStock, 10)
          if (isNaN(stock) || stock < 0) {
            throw new Error('안전재고는 0 이상의 정수여야 합니다.')
          }
        }

        // 품목유형 검증
        const mappedType = itemTypeMap[row.itemType] || row.itemType || 'GOODS'
        if (!VALID_TYPES.has(mappedType)) {
          throw new Error(`유효하지 않은 품목유형입니다: ${row.itemType}`)
        }

        if (existingCodeSet.has(itemCode)) {
          throw new Error(`품목코드 '${itemCode}'가 이미 존재합니다.`)
        }

        if (row.barcode && existingBarcodeSet.has(String(row.barcode))) {
          throw new Error(`바코드 '${row.barcode}'가 이미 존재합니다.`)
        }

        await prisma.item.create({
          data: {
            itemCode,
            itemName,
            specification: row.specification ? String(row.specification).slice(0, 500) : undefined,
            unit: row.unit ? String(row.unit).trim().slice(0, 20) : 'EA',
            standardPrice: row.standardPrice ? parseFloat(row.standardPrice) : 0,
            safetyStock: row.safetyStock ? parseInt(row.safetyStock, 10) : 0,
            itemType: mappedType,
            barcode: row.barcode ? String(row.barcode).trim() : undefined,
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

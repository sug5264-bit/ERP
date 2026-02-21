import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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
    const existingCodeSet = new Set(existingItems.map(i => i.itemCode))
    const existingBarcodeSet = new Set(existingBarcodes.map(i => i.barcode))

    const itemTypeMap: Record<string, string> = {
      '상품': 'GOODS', '제품': 'PRODUCT', '원자재': 'RAW_MATERIAL',
      '반제품': 'SEMI_PRODUCT', '부자재': 'SUB_MATERIAL',
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel row (header=1, data starts at 2)
      try {
        if (!row.itemCode || !row.itemName) {
          throw new Error('품목코드와 품목명은 필수입니다.')
        }

        if (existingCodeSet.has(String(row.itemCode))) {
          throw new Error(`품목코드 '${row.itemCode}'가 이미 존재합니다.`)
        }

        if (row.barcode && existingBarcodeSet.has(String(row.barcode))) {
          throw new Error(`바코드 '${row.barcode}'가 이미 존재합니다.`)
        }

        await prisma.item.create({
          data: {
            itemCode: String(row.itemCode),
            itemName: String(row.itemName),
            specification: row.specification ? String(row.specification) : undefined,
            unit: row.unit ? String(row.unit) : 'EA',
            standardPrice: row.standardPrice ? parseFloat(row.standardPrice) : 0,
            safetyStock: row.safetyStock ? parseInt(row.safetyStock, 10) : 0,
            itemType: itemTypeMap[row.itemType] || row.itemType || 'GOODS',
            barcode: row.barcode ? String(row.barcode) : undefined,
          },
        })
        existingCodeSet.add(String(row.itemCode))
        if (row.barcode) existingBarcodeSet.add(String(row.barcode))
        success++
      } catch (err: any) {
        failed++
        errors.push({ row: rowNum, message: err.message || '알 수 없는 오류' })
      }
    }

    return successResponse({ success, failed, errors })
  } catch (error) {
    return handleApiError(error)
  }
}

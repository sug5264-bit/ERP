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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel row (header=1, data starts at 2)
      try {
        if (!row.itemCode || !row.itemName) {
          throw new Error('품목코드와 품목명은 필수입니다.')
        }

        const existing = await prisma.item.findUnique({ where: { itemCode: row.itemCode } })
        if (existing) {
          throw new Error(`품목코드 '${row.itemCode}'가 이미 존재합니다.`)
        }

        if (row.barcode) {
          const existingBarcode = await prisma.item.findUnique({ where: { barcode: row.barcode } })
          if (existingBarcode) {
            throw new Error(`바코드 '${row.barcode}'가 이미 존재합니다.`)
          }
        }

        const itemTypeMap: Record<string, string> = {
          '상품': 'GOODS', '제품': 'PRODUCT', '원자재': 'RAW_MATERIAL',
          '반제품': 'SEMI_PRODUCT', '부자재': 'SUB_MATERIAL',
        }

        await prisma.item.create({
          data: {
            itemCode: String(row.itemCode),
            itemName: String(row.itemName),
            specification: row.specification ? String(row.specification) : undefined,
            unit: row.unit ? String(row.unit) : 'EA',
            standardPrice: row.standardPrice ? parseFloat(row.standardPrice) : 0,
            safetyStock: row.safetyStock ? parseInt(row.safetyStock) : 0,
            itemType: itemTypeMap[row.itemType] || row.itemType || 'GOODS',
            barcode: row.barcode ? String(row.barcode) : undefined,
          },
        })
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

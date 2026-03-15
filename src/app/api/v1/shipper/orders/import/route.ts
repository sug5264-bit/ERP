import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse, errorResponse } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const userId = authResult.session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { shipperId: true, accountType: true },
    })

    if (!user?.shipperId || user.accountType !== 'SHIPPER') {
      return errorResponse('화주사 계정이 아닙니다.', 'FORBIDDEN', 403)
    }

    const shipperId = user.shipperId
    const body = await request.json()
    const rows = body.rows as Record<string, unknown>[]

    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse('업로드할 데이터가 없습니다.', 'VALIDATION_ERROR', 400)
    }

    let success = 0
    let failed = 0
    const errors: { row: number; message: string }[] = []

    // 트랜잭션으로 모든 행을 원자적으로 처리
    await prisma.$transaction(async (tx) => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')

      // 현재 마지막 시퀀스 번호 조회
      const lastOrder = await tx.shipperOrder.findFirst({
        where: { orderNo: { startsWith: `SH-${today}` } },
        orderBy: { orderNo: 'desc' },
      })
      let seq = lastOrder ? parseInt(lastOrder.orderNo.slice(-4), 10) : 0

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2 // 엑셀 행 번호 (헤더 = 1행)

        // 필수 필드 검증
        const recipientName = row.recipientName ? String(row.recipientName).trim() : ''
        const recipientAddress = row.recipientAddress ? String(row.recipientAddress).trim() : ''
        const itemName = row.itemName ? String(row.itemName).trim() : ''

        const missingFields: string[] = []
        if (!recipientName) missingFields.push('수취인명')
        if (!recipientAddress) missingFields.push('수취인 주소')
        if (!itemName) missingFields.push('상품명')

        if (missingFields.length > 0) {
          failed++
          errors.push({ row: rowNum, message: `필수항목 누락: ${missingFields.join(', ')}` })
          continue
        }

        try {
          seq++
          const orderNo = `SH-${today}-${String(seq).padStart(4, '0')}`

          const quantity = row.quantity ? Number(row.quantity) : 1
          const weight = row.weight ? Number(row.weight) : null

          await tx.shipperOrder.create({
            data: {
              orderNo,
              shipperId,
              orderDate: new Date(),
              senderName: row.senderName ? String(row.senderName).trim() : '',
              senderPhone: row.senderPhone ? String(row.senderPhone).trim() : null,
              senderAddress: row.senderAddress ? String(row.senderAddress).trim() : null,
              recipientName,
              recipientPhone: row.recipientPhone ? String(row.recipientPhone).trim() : null,
              recipientZipCode: row.recipientZipCode ? String(row.recipientZipCode).trim() : null,
              recipientAddress,
              itemName,
              quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
              weight: weight !== null && Number.isFinite(weight) ? weight : null,
              shippingMethod: row.shippingMethod ? String(row.shippingMethod).trim() : 'NORMAL',
              specialNote: row.specialNote ? String(row.specialNote).trim() : null,
              status: 'RECEIVED',
            },
          })
          success++
        } catch (err) {
          failed++
          errors.push({
            row: rowNum,
            message: err instanceof Error ? err.message : '등록 중 오류가 발생했습니다.',
          })
        }
      }
    })

    return successResponse({ success, failed, errors })
  } catch (error) {
    return handleApiError(error)
  }
}

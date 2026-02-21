import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await request.json()
    const { trackings } = body as {
      trackings: { deliveryNo: string; trackingNo: string; carrier: string }[]
    }

    if (!trackings || !Array.isArray(trackings) || trackings.length === 0) {
      return errorResponse('운송장 데이터가 없습니다.', 'VALIDATION_ERROR', 400)
    }

    let success = 0
    let failed = 0
    const errors: string[] = []

    // 배치 조회로 존재하는 납품번호 확인 (N+1 → 1번 쿼리)
    const deliveryNos = trackings.map(t => t.deliveryNo)
    const existingDeliveries = await prisma.delivery.findMany({
      where: { deliveryNo: { in: deliveryNos } },
      select: { deliveryNo: true },
    })
    const existingSet = new Set(existingDeliveries.map(d => d.deliveryNo))

    for (const tracking of trackings) {
      if (!tracking.deliveryNo || !tracking.trackingNo) {
        failed++
        errors.push(`${tracking.deliveryNo || '(빈값)'}: 납품번호와 운송장번호는 필수입니다.`)
        continue
      }
      if (!existingSet.has(tracking.deliveryNo)) {
        failed++
        errors.push(`${tracking.deliveryNo}: 납품번호를 찾을 수 없습니다.`)
        continue
      }
      try {
        await prisma.delivery.updateMany({
          where: { deliveryNo: tracking.deliveryNo },
          data: {
            trackingNo: tracking.trackingNo,
            carrier: tracking.carrier,
            status: 'SHIPPED',
          },
        })
        success++
      } catch {
        failed++
        errors.push(`${tracking.deliveryNo}: 업데이트 중 오류가 발생했습니다.`)
      }
    }

    return successResponse({
      total: trackings.length,
      success,
      failed,
      errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

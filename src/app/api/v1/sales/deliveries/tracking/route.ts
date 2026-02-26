import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const { trackings } = body as {
      trackings: { deliveryNo: string; trackingNo: string; carrier: string }[]
    }

    if (!trackings || !Array.isArray(trackings) || trackings.length === 0) {
      return errorResponse('운송장 데이터가 없습니다.', 'VALIDATION_ERROR', 400)
    }

    // 입력값 타입 검증
    for (const t of trackings) {
      if (typeof t.deliveryNo !== 'string' || typeof t.trackingNo !== 'string') {
        return errorResponse('납품번호와 운송장번호는 문자열이어야 합니다.', 'VALIDATION_ERROR', 400)
      }
      if (t.carrier !== undefined && typeof t.carrier !== 'string') {
        return errorResponse('운송사는 문자열이어야 합니다.', 'VALIDATION_ERROR', 400)
      }
    }

    let success = 0
    let failed = 0
    const errors: string[] = []

    // 배치 조회로 존재하는 납품번호 확인 (N+1 → 1번 쿼리)
    const deliveryNos = trackings.map((t) => t.deliveryNo)
    const existingDeliveries = await prisma.delivery.findMany({
      where: { deliveryNo: { in: deliveryNos } },
      select: { deliveryNo: true, status: true },
    })
    const existingMap = new Map(existingDeliveries.map((d) => [d.deliveryNo, d.status]))

    // 사전 유효성 검증
    const validTrackings: typeof trackings = []
    for (const tracking of trackings) {
      if (!tracking.deliveryNo || !tracking.trackingNo) {
        failed++
        errors.push(`${tracking.deliveryNo || '(빈값)'}: 납품번호와 운송장번호는 필수입니다.`)
        continue
      }
      if (!existingMap.has(tracking.deliveryNo)) {
        failed++
        errors.push(`${tracking.deliveryNo}: 납품번호를 찾을 수 없습니다.`)
        continue
      }
      if (existingMap.get(tracking.deliveryNo) === 'SHIPPED') {
        failed++
        errors.push(`${tracking.deliveryNo}: 이미 출하 처리된 납품입니다.`)
        continue
      }
      validTrackings.push(tracking)
    }

    // 트랜잭션으로 일괄 업데이트
    if (validTrackings.length > 0) {
      try {
        await prisma.$transaction(
          validTrackings.map((tracking) =>
            prisma.delivery.updateMany({
              where: { deliveryNo: tracking.deliveryNo },
              data: {
                trackingNo: tracking.trackingNo,
                carrier: tracking.carrier,
                status: 'SHIPPED',
              },
            })
          )
        )
        success = validTrackings.length
      } catch {
        validTrackings.forEach((t) => {
          errors.push(`${t.deliveryNo}: 업데이트 중 오류가 발생했습니다.`)
          failed++
        })
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

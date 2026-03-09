import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

type RouteContext = { params: Promise<{ id: string }> }

// 허용된 업데이트 필드 화이트리스트
const ALLOWED_FIELDS = new Set(['status', 'inspectedBy', 'receivingDate'])

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params
    const body = await request.json()

    // 존재 여부 확인
    const existing = await prisma.receiving.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!existing) {
      return errorResponse('해당 입고를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    // 허용된 필드만 추출 (임의 필드 주입 방지)
    const safeData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        safeData[key] = key === 'receivingDate' && value ? new Date(value as string) : value
      }
    }

    if (Object.keys(safeData).length === 0) {
      return errorResponse('업데이트할 유효한 필드가 없습니다.', 'INVALID_INPUT')
    }

    const receiving = await prisma.receiving.update({
      where: { id },
      data: safeData,
    })

    return successResponse(receiving)
  } catch (error) {
    return handleApiError(error)
  }
}

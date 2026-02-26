import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('hr', 'read')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const payroll = await prisma.payrollHeader.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            employee: {
              select: {
                id: true,
                nameKo: true,
                employeeNo: true,
                department: { select: { name: true } },
                position: { select: { name: true } },
              },
            },
          },
          orderBy: { employee: { employeeNo: 'asc' } },
        },
      },
    })
    if (!payroll) return errorResponse('급여 데이터를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(payroll)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('hr', 'update')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    if (body.status) {
      const validStatuses = ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED']
      if (!validStatuses.includes(body.status)) {
        return errorResponse('유효하지 않은 상태값입니다.', 'INVALID_STATUS', 400)
      }
      // 유효한 상태 전이 맵: DRAFT→CONFIRMED→PAID, DRAFT→CANCELLED, CONFIRMED→CANCELLED
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['CONFIRMED', 'CANCELLED'],
        CONFIRMED: ['PAID', 'CANCELLED'],
        PAID: [],
        CANCELLED: [],
      }

      // 트랜잭션으로 원자적 상태 전이 (race condition 방지)
      const payroll = await prisma.$transaction(async (tx) => {
        const existing = await tx.payrollHeader.findUnique({ where: { id } })
        if (!existing) throw new Error('NOT_FOUND')
        const allowed = validTransitions[existing.status] || []
        if (!allowed.includes(body.status)) {
          throw new Error(`INVALID:${existing.status}→${body.status}`)
        }
        return tx.payrollHeader.update({ where: { id }, data: { status: body.status } })
      })
      return successResponse(payroll)
    }
    return errorResponse('변경할 데이터가 없습니다.', 'BAD_REQUEST', 400)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return errorResponse('급여 데이터를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      }
      if (error.message.startsWith('INVALID:')) {
        const [from, to] = error.message.slice(8).split('→')
        return errorResponse(`'${from}' 상태에서 '${to}'(으)로 변경할 수 없습니다.`, 'INVALID_STATUS', 400)
      }
    }
    return handleApiError(error)
  }
}

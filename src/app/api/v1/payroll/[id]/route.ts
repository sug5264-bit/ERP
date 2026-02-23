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
      const existing = await prisma.payrollHeader.findUnique({ where: { id } })
      if (!existing) return errorResponse('급여 데이터를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (existing.status === 'PAID') {
        return errorResponse('이미 지급 완료된 급여는 상태를 변경할 수 없습니다.', 'INVALID_STATUS', 400)
      }
      const payroll = await prisma.payrollHeader.update({ where: { id }, data: { status: body.status } })
      return successResponse(payroll)
    }
    return errorResponse('변경할 데이터가 없습니다.', 'BAD_REQUEST', 400)
  } catch (error) {
    return handleApiError(error)
  }
}

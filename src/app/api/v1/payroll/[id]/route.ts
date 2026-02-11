import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const payroll = await prisma.payrollHeader.findUnique({
      where: { id },
      include: {
        details: {
          include: { employee: { select: { id: true, nameKo: true, employeeNo: true, department: { select: { name: true } }, position: { select: { name: true } } } } },
          orderBy: { employee: { employeeNo: 'asc' } },
        },
      },
    })
    if (!payroll) return errorResponse('급여 데이터를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(payroll)
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const body = await request.json()
    if (body.status) {
      const payroll = await prisma.payrollHeader.update({ where: { id }, data: { status: body.status } })
      return successResponse(payroll)
    }
    return errorResponse('변경할 데이터가 없습니다.', 'BAD_REQUEST', 400)
  } catch (error) { return handleApiError(error) }
}

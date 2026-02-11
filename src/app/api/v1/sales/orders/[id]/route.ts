import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const order = await prisma.salesOrder.findUnique({
      where: { id }, include: { partner: true, employee: true, quotation: true, details: { include: { item: true }, orderBy: { lineNo: 'asc' } }, deliveries: { include: { details: true } } },
    })
    if (!order) return errorResponse('수주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(order)
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const body = await request.json()
    if (body.action === 'complete') {
      const o = await prisma.salesOrder.update({ where: { id }, data: { status: 'COMPLETED' } })
      return successResponse(o)
    }
    if (body.action === 'cancel') {
      const o = await prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' } })
      return successResponse(o)
    }
    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION')
  } catch (error) { return handleApiError(error) }
}

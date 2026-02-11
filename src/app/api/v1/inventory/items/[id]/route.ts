import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'
import { updateItemSchema } from '@/lib/validations/inventory'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    const item = await prisma.item.findUnique({
      where: { id },
      include: { category: true, stockBalances: { include: { warehouse: true, zone: true } } },
    })
    if (!item) return errorResponse('품목을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(item)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()
    const data = updateItemSchema.parse(body)

    const item = await prisma.item.update({ where: { id }, data })
    return successResponse(item)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    const balances = await prisma.stockBalance.findMany({ where: { itemId: id, quantity: { gt: 0 } } })
    if (balances.length > 0) return errorResponse('재고가 존재하는 품목은 삭제할 수 없습니다.', 'HAS_STOCK')

    await prisma.item.delete({ where: { id } })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}

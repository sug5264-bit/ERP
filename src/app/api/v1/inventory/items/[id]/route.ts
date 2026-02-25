import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { updateItemSchema } from '@/lib/validations/inventory'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

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
    const authResult = await requirePermissionCheck('inventory', 'update')
    if (isErrorResponse(authResult)) return authResult

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
    const authResult = await requirePermissionCheck('inventory', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    // 사용 중인 품목은 삭제 대신 비활성화 (비즈니스 데이터 보호)
    const [salesOrderCount, purchaseOrderCount, deliveryCount, movementCount] = await Promise.all([
      prisma.salesOrderDetail.count({ where: { itemId: id } }),
      prisma.purchaseOrderDetail.count({ where: { itemId: id } }),
      prisma.deliveryDetail.count({ where: { itemId: id } }),
      prisma.stockMovementDetail.count({ where: { itemId: id } }),
    ])

    if (salesOrderCount + purchaseOrderCount + deliveryCount + movementCount > 0) {
      // 거래 이력이 있으면 비활성화 처리
      await prisma.item.update({ where: { id }, data: { isActive: false } })
      return successResponse({ deactivated: true, message: '거래 이력이 있어 비활성화 처리되었습니다.' })
    }

    // 거래 이력이 없으면 안전하게 삭제
    await prisma.$transaction(async (tx) => {
      await tx.quotationDetail.deleteMany({ where: { itemId: id } })
      await tx.purchaseRequestDetail.deleteMany({ where: { itemId: id } })
      await tx.stockBalance.deleteMany({ where: { itemId: id } })
      await tx.item.delete({ where: { id } })
    })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()

    const where: Record<string, unknown> = { shipperId }

    if (search) {
      where.shipperItem = {
        itemName: { contains: search, mode: 'insensitive' },
      }
    }

    const inventory = await prisma.shipperInventory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        zoneName: true,
        quantity: true,
        lotNo: true,
        expiryDate: true,
        inboundDate: true,
        memo: true,
        shipperItem: {
          select: {
            itemCode: true,
            itemName: true,
          },
        },
      },
    })

    // Flatten shipperItem for easier frontend consumption
    const result = inventory.map((inv) => ({
      id: inv.id,
      itemCode: inv.shipperItem.itemCode,
      itemName: inv.shipperItem.itemName,
      zoneName: inv.zoneName,
      quantity: inv.quantity,
      lotNo: inv.lotNo,
      expiryDate: inv.expiryDate,
      inboundDate: inv.inboundDate,
      memo: inv.memo,
    }))

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

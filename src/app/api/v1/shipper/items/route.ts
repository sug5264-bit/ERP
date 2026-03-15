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
      where.OR = [
        { itemName: { contains: search, mode: 'insensitive' } },
        { itemCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const items = await prisma.shipperItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        itemCode: true,
        itemName: true,
        barcode: true,
        category: true,
        weight: true,
        storageTemp: true,
        unitPrice: true,
        isActive: true,
        memo: true,
        createdAt: true,
      },
    })

    return successResponse(items)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json()

    // 필수값 검증
    if (!body.itemCode || typeof body.itemCode !== 'string' || !body.itemCode.trim()) {
      return errorResponse('품목코드는 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (!body.itemName || typeof body.itemName !== 'string' || !body.itemName.trim()) {
      return errorResponse('품목명은 필수입니다.', 'VALIDATION_ERROR', 400)
    }

    // 중복 체크 (shipperId + itemCode unique constraint)
    const existing = await prisma.shipperItem.findUnique({
      where: {
        shipperId_itemCode: {
          shipperId,
          itemCode: body.itemCode.trim(),
        },
      },
    })

    if (existing) {
      return errorResponse('이미 존재하는 품목코드입니다.', 'DUPLICATE', 400)
    }

    const item = await prisma.shipperItem.create({
      data: {
        shipperId,
        itemCode: body.itemCode.trim(),
        itemName: body.itemName.trim(),
        barcode: body.barcode?.trim() || null,
        category: body.category?.trim() || null,
        weight: body.weight != null ? body.weight : null,
        storageTemp: body.storageTemp || 'AMBIENT',
        shelfLifeDays: body.shelfLifeDays != null ? body.shelfLifeDays : null,
        unitPrice: body.unitPrice != null ? body.unitPrice : null,
        memo: body.memo?.trim() || null,
      },
    })

    return successResponse(item)
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const relatedTable = sp.get('relatedTable')
    const relatedId = sp.get('relatedId')

    if (!relatedTable) {
      return errorResponse('relatedTable이 필요합니다.', 'VALIDATION_ERROR')
    }

    const VALID_TABLES = [
      'SalesOrder',
      'SalesOrderPost',
      'Quotation',
      'Delivery',
      'DeliveryPost',
      'DeliveryReply',
      'DeliveryReplyPost',
      'DeliveryPostStatus',
      'SalesReturn',
      'Partner',
      'Item',
      'PurchaseOrder',
      'Voucher',
      'Employee',
      'Project',
      'Recruitment',
    ]
    if (!VALID_TABLES.includes(relatedTable)) {
      return errorResponse('유효하지 않은 테이블입니다.', 'VALIDATION_ERROR', 400)
    }

    const where: Record<string, unknown> = { relatedTable }
    if (relatedId) where.relatedId = relatedId

    const notes = await prisma.note.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100, // 과도한 데이터 반환 방지
    })

    return successResponse(notes)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const { content, relatedTable, relatedId } = body

    if (!content?.trim() || !relatedTable || !relatedId) {
      return errorResponse('content, relatedTable, relatedId가 필요합니다.', 'VALIDATION_ERROR')
    }

    const VALID_TABLES = [
      'SalesOrder',
      'SalesOrderPost',
      'Quotation',
      'Delivery',
      'DeliveryPost',
      'DeliveryReply',
      'DeliveryReplyPost',
      'DeliveryPostStatus',
      'SalesReturn',
      'Partner',
      'Item',
      'PurchaseOrder',
      'Voucher',
      'Employee',
      'Project',
      'Recruitment',
    ]
    if (!VALID_TABLES.includes(relatedTable)) {
      return errorResponse('유효하지 않은 테이블입니다.', 'VALIDATION_ERROR', 400)
    }

    const note = await prisma.note.create({
      data: {
        content: content.trim(),
        relatedTable,
        relatedId,
        createdBy: authResult.session.user.id,
      },
    })

    return successResponse(note)
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

/**
 * ERP 출고관리 통합 API
 * 기존 N+4 쿼리(DeliveryPost + Status + Reply + ReplyAttachment)를 1회 호출로 통합
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const shipperId = sp.get('shipperId')
    const page = Math.max(1, Number(sp.get('page')) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 50))

    // 1. 발주글 (ShipperOrderPost) 조회
    const orderWhere: Record<string, unknown> = { relatedTable: 'ShipperOrderPost' }
    if (shipperId && shipperId !== 'all') orderWhere.relatedId = shipperId

    const [orderPosts, totalCount] = await Promise.all([
      prisma.note.findMany({
        where: orderWhere,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.note.count({ where: orderWhere }),
    ])

    if (orderPosts.length === 0) {
      return successResponse([], { page, pageSize, totalCount, totalPages: 0 })
    }

    const orderIds = orderPosts.map((n) => n.id)

    // 2. 연관 데이터를 한 번에 병렬 조회
    const [deliveryPosts, orderAttachments] = await Promise.all([
      prisma.note.findMany({
        where: { relatedTable: 'ShipperDeliveryPost', relatedId: { in: orderIds } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attachment.findMany({
        where: { relatedTable: 'ShipperOrderAttachment', relatedId: { in: orderIds } },
      }),
    ])

    const dpIds = deliveryPosts.map((dp) => dp.id)

    // 3. 출고 하위 데이터 병렬 조회
    const [deliveryStatuses, deliveryReplies] =
      dpIds.length > 0
        ? await Promise.all([
            prisma.note.findMany({
              where: { relatedTable: 'ShipperDeliveryPostStatus', relatedId: { in: dpIds } },
              orderBy: { createdAt: 'desc' },
            }),
            prisma.note.findMany({
              where: { relatedTable: 'ShipperDeliveryReply', relatedId: { in: dpIds } },
              orderBy: { createdAt: 'asc' },
            }),
          ])
        : [[], []]

    const replyIds = deliveryReplies.map((r) => r.id)
    const replyAttachments =
      replyIds.length > 0
        ? await prisma.attachment.findMany({
            where: { relatedTable: 'ShipperDeliveryReplyPost', relatedId: { in: replyIds } },
          })
        : []

    // 4. 조립
    const data = orderPosts.map((note) => {
      const dp = deliveryPosts.find((d) => d.relatedId === note.id)
      const dpStatus = dp ? deliveryStatuses.find((s) => s.relatedId === dp.id)?.content || 'PREPARING' : null
      const dpReplies = dp
        ? deliveryReplies
            .filter((r) => r.relatedId === dp.id)
            .map((r) => ({
              ...r,
              attachments: replyAttachments.filter((a) => a.relatedId === r.id),
            }))
        : []

      return {
        ...note,
        attachments: orderAttachments.filter((a) => a.relatedId === note.id),
        deliveryPost: dp ? { ...dp, status: dpStatus, replies: dpReplies } : null,
      }
    })

    return successResponse(data, {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

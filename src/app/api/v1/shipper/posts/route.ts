import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

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

    // 해당 화주사가 작성한 게시글 조회 (relatedId = shipperId)
    const notes = await prisma.note.findMany({
      where: {
        relatedTable: 'ShipperOrderPost',
        relatedId: user.shipperId,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const noteIds = notes.map((n) => n.id)

    // 첨부파일 조회
    const attachments = await prisma.attachment.findMany({
      where: {
        relatedTable: 'ShipperOrderAttachment',
        relatedId: { in: noteIds },
      },
    })

    // 출고 게시글 (ShipperDeliveryPost) - relatedId = ShipperOrderPost noteId
    const deliveryPosts = await prisma.note.findMany({
      where: {
        relatedTable: 'ShipperDeliveryPost',
        relatedId: { in: noteIds },
      },
      orderBy: { createdAt: 'desc' },
    })

    const deliveryPostIds = deliveryPosts.map((dp) => dp.id)

    // 출고 상태
    const deliveryStatuses =
      deliveryPostIds.length > 0
        ? await prisma.note.findMany({
            where: {
              relatedTable: 'ShipperDeliveryPostStatus',
              relatedId: { in: deliveryPostIds },
            },
            orderBy: { createdAt: 'desc' },
          })
        : []

    // 출고 답글
    const deliveryReplies =
      deliveryPostIds.length > 0
        ? await prisma.note.findMany({
            where: {
              relatedTable: 'ShipperDeliveryReply',
              relatedId: { in: deliveryPostIds },
            },
            orderBy: { createdAt: 'asc' },
          })
        : []

    // 출고 답글 첨부파일
    const deliveryReplyIds = deliveryReplies.map((r) => r.id)
    const deliveryReplyAttachments =
      deliveryReplyIds.length > 0
        ? await prisma.attachment.findMany({
            where: {
              relatedTable: 'ShipperDeliveryReplyPost',
              relatedId: { in: deliveryReplyIds },
            },
          })
        : []

    const data = notes.map((note) => {
      const dp = deliveryPosts.find((d) => d.relatedId === note.id)
      const dpStatus = dp ? deliveryStatuses.find((s) => s.relatedId === dp.id)?.content || 'PREPARING' : null
      const dpReplies = dp
        ? deliveryReplies
            .filter((r) => r.relatedId === dp.id)
            .map((r) => ({
              ...r,
              attachments: deliveryReplyAttachments.filter((a) => a.relatedId === r.id),
            }))
        : []

      return {
        ...note,
        replies: [],
        attachments: attachments.filter((a) => a.relatedId === note.id),
        deliveryPost: dp ? { ...dp, status: dpStatus, replies: dpReplies } : null,
      }
    })

    return successResponse(data)
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

    const body = await request.json()
    if (!body.content?.trim()) {
      return errorResponse('내용을 입력해주세요.', 'VALIDATION_ERROR', 400)
    }

    const note = await prisma.note.create({
      data: {
        content: body.content.trim(),
        relatedTable: 'ShipperOrderPost',
        relatedId: user.shipperId,
        createdBy: userId,
      },
    })

    // Auto-create mirrored delivery post (출고관리 게시글) + PREPARING status
    const deliveryPost = await prisma.note.create({
      data: {
        content: `[발주글]\n${body.content.trim()}`,
        relatedTable: 'ShipperDeliveryPost',
        relatedId: note.id,
        createdBy: userId,
      },
    })

    await prisma.note.create({
      data: {
        content: 'PREPARING',
        relatedTable: 'ShipperDeliveryPostStatus',
        relatedId: deliveryPost.id,
        createdBy: userId,
      },
    })

    return successResponse(note)
  } catch (error) {
    return handleApiError(error)
  }
}

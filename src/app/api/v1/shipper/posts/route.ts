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

    // 각 게시글의 답글 조회
    const noteIds = notes.map((n) => n.id)
    const replies = await prisma.note.findMany({
      where: {
        relatedTable: 'ShipperOrderReply',
        relatedId: { in: noteIds },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 첨부파일 조회
    const attachments = await prisma.attachment.findMany({
      where: {
        relatedTable: 'ShipperOrderAttachment',
        relatedId: { in: noteIds },
      },
    })

    const data = notes.map((note) => ({
      ...note,
      replies: replies.filter((r) => r.relatedId === note.id),
      attachments: attachments.filter((a) => a.relatedId === note.id),
    }))

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

    return successResponse(note)
  } catch (error) {
    return handleApiError(error)
  }
}

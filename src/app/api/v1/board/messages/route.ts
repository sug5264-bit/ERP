import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createMessageSchema } from '@/lib/validations/board'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const box = sp.get('box') || 'received'
    const where: any = box === 'sent' ? { senderId: session.user!.id! } : { receiverId: session.user!.id! }
    const [items, totalCount] = await Promise.all([
      prisma.message.findMany({
        where, include: { sender: { select: { id: true, name: true } }, receiver: { select: { id: true, name: true } } },
        orderBy: { sentAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.message.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createMessageSchema.parse(body)
    const message = await prisma.message.create({
      data: { senderId: session.user!.id!, receiverId: data.receiverId, subject: data.subject, content: data.content },
      include: { receiver: { select: { id: true, name: true } } },
    })
    return successResponse(message)
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    if (!body.messageId || typeof body.messageId !== 'string' || body.messageId.trim() === '') {
      return errorResponse('유효한 메시지 ID가 필요합니다.', 'INVALID_INPUT', 400)
    }
    await prisma.message.update({ where: { id: body.messageId, receiverId: session.user!.id! }, data: { isRead: true, readAt: new Date() } })
    return successResponse({ updated: true })
  } catch (error) { return handleApiError(error) }
}

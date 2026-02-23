import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

// GET: 내 알림 목록
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = req.nextUrl
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') || '20'))

    const where: any = { userId: authResult.session.user.id }
    if (unreadOnly) where.isRead = false

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
      }),
      prisma.notification.count({
        where: { userId: authResult.session.user.id, isRead: false },
      }),
    ])

    return successResponse(notifications, { page: 1, pageSize, totalCount: unreadCount, totalPages: 1 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST: 알림 생성 (시스템 내부용)
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const { userId, type, title, message, relatedUrl } = body

    if (!userId || !type || !title || !message) {
      return errorResponse('필수 항목을 입력하세요.', 'BAD_REQUEST', 400)
    }

    const notification = await prisma.notification.create({
      data: { userId, type, title, message, relatedUrl: relatedUrl || null },
    })

    return successResponse(notification)
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT: 알림 읽음 처리
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const { action, id } = body

    if (action === 'readAll') {
      await prisma.notification.updateMany({
        where: { userId: authResult.session.user.id, isRead: false },
        data: { isRead: true },
      })
      return successResponse({ updated: true })
    }

    if (action === 'read' && id) {
      await prisma.notification.update({
        where: { id, userId: authResult.session.user.id },
        data: { isRead: true },
      })
      return successResponse({ updated: true })
    }

    if (action === 'deleteAll') {
      await prisma.notification.deleteMany({
        where: { userId: authResult.session.user.id, isRead: true },
      })
      return successResponse({ deleted: true })
    }

    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION', 400)
  } catch (error) {
    return handleApiError(error)
  }
}

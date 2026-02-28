import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('board', 'read')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const existing = await prisma.post.findUnique({ where: { id }, select: { isActive: true } })
    if (!existing) return errorResponse('게시글을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (!existing.isActive) return errorResponse('삭제된 게시글입니다.', 'NOT_FOUND', 404)
    const post = await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      include: {
        board: true,
        author: { select: { id: true, name: true } },
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    })
    return successResponse(post)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('board', 'delete')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } })
    if (!post) return errorResponse('게시글을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (post.authorId !== authResult.session.user.id) {
      return errorResponse('본인의 게시글만 삭제할 수 있습니다.', 'FORBIDDEN', 403)
    }
    await prisma.post.update({ where: { id }, data: { isActive: false } })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}

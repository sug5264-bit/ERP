import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const post = await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      include: {
        board: true,
        author: { select: { id: true, name: true } },
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    return successResponse(post)
  } catch (error) { return handleApiError(error) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } })
    if (!post) return errorResponse('게시글을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (post.authorId !== session.user!.id!) {
      return errorResponse('본인의 게시글만 삭제할 수 있습니다.', 'FORBIDDEN', 403)
    }
    await prisma.post.update({ where: { id }, data: { isActive: false } })
    return successResponse({ deleted: true })
  } catch (error) { return handleApiError(error) }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'
import { createCommentSchema } from '@/lib/validations/board'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const body = await request.json()
    const data = createCommentSchema.parse({ ...body, postId: id })
    const comment = await prisma.postComment.create({
      data: { postId: id, authorId: session.user!.id!, content: data.content, parentCommentId: data.parentCommentId || null },
      include: { author: { select: { id: true, name: true } } },
    })
    return successResponse(comment)
  } catch (error) { return handleApiError(error) }
}

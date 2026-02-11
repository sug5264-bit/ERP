import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createPostSchema } from '@/lib/validations/board'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: any = { isActive: true }
    const boardId = sp.get('boardId')
    if (boardId) where.boardId = boardId
    const search = sp.get('search')
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [items, totalCount] = await Promise.all([
      prisma.post.findMany({
        where, include: { board: true, author: { select: { id: true, name: true } }, _count: { select: { comments: true } } },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], skip, take: pageSize,
      }),
      prisma.post.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createPostSchema.parse(body)
    const post = await prisma.post.create({
      data: { ...data, authorId: session.user!.id! },
      include: { board: true, author: { select: { id: true, name: true } } },
    })
    return successResponse(post)
  } catch (error) { return handleApiError(error) }
}

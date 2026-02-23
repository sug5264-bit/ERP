import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createPostSchema } from '@/lib/validations/board'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('board', 'read')
    if (isErrorResponse(authResult)) return authResult
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: any = { isActive: true }
    const boardId = sp.get('boardId')
    if (boardId) where.boardId = boardId
    const boardCode = sp.get('boardCode')
    if (boardCode) where.board = { boardCode }
    const search = sp.get('search')
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [items, totalCount] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          board: { select: { id: true, boardCode: true, boardName: true } },
          author: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.post.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('board', 'create')
    if (isErrorResponse(authResult)) return authResult
    const body = await request.json()
    const data = createPostSchema.parse(body)
    const post = await prisma.post.create({
      data: { ...data, authorId: authResult.session.user.id },
      include: { board: true, author: { select: { id: true, name: true } } },
    })
    return successResponse(post)
  } catch (error) {
    return handleApiError(error)
  }
}

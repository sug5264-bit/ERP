import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const relatedTable = sp.get('relatedTable')
    const relatedId = sp.get('relatedId')

    if (!relatedTable || !relatedId) {
      return errorResponse('relatedTable과 relatedId가 필요합니다.', 'VALIDATION_ERROR')
    }

    const notes = await prisma.note.findMany({
      where: { relatedTable, relatedId },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(notes)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const { content, relatedTable, relatedId } = body

    if (!content?.trim() || !relatedTable || !relatedId) {
      return errorResponse('content, relatedTable, relatedId가 필요합니다.', 'VALIDATION_ERROR')
    }

    const note = await prisma.note.create({
      data: {
        content: content.trim(),
        relatedTable,
        relatedId,
        createdBy: authResult.session.user.id,
      },
    })

    return successResponse(note)
  } catch (error) {
    return handleApiError(error)
  }
}

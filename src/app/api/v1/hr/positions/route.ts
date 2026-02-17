import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPositionSchema } from '@/lib/validations/hr'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const positions = await prisma.position.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { sortOrder: 'asc' },
    })

    return successResponse(positions, undefined, { cache: 's-maxage=300, stale-while-revalidate=600' })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const validated = createPositionSchema.parse(body)

    const pos = await prisma.position.create({ data: validated })
    return successResponse(pos)
  } catch (error) {
    return handleApiError(error)
  }
}

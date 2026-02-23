import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPositionSchema } from '@/lib/validations/hr'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const authResult = await requirePermissionCheck('hr', 'read')
    if (isErrorResponse(authResult)) return authResult

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
    const authResult = await requirePermissionCheck('hr', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const validated = createPositionSchema.parse(body)

    const pos = await prisma.position.create({ data: validated })
    return successResponse(pos)
  } catch (error) {
    return handleApiError(error)
  }
}

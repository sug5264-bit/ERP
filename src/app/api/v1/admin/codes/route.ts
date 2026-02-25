import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { successResponse, errorResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const groupCode = req.nextUrl.searchParams.get('groupCode')

    const where = groupCode ? { groupCode } : {}

    const codes = await prisma.commonCode.findMany({
      where,
      orderBy: [{ groupCode: 'asc' }, { sortOrder: 'asc' }],
    })

    return successResponse(codes)
  } catch (error) {
    return handleApiError(error)
  }
}

const createCodeSchema = z.object({
  groupCode: z.string().min(1),
  code: z.string().min(1),
  nameKo: z.string().min(1),
  nameEn: z.string().optional(),
  sortOrder: z.number().optional(),
  extra: z.any().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const validated = createCodeSchema.parse(body)

    const existing = await prisma.commonCode.findFirst({
      where: { groupCode: validated.groupCode, code: validated.code },
    })
    if (existing) return errorResponse('이미 존재하는 코드입니다.', 'CONFLICT', 409)

    const code = await prisma.commonCode.create({ data: validated })
    return successResponse(code)
  } catch (error) {
    return handleApiError(error)
  }
}

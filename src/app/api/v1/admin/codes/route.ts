import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const validated = createCodeSchema.parse(body)

    const code = await prisma.commonCode.create({ data: validated })
    return successResponse(code)
  } catch (error) {
    return handleApiError(error)
  }
}

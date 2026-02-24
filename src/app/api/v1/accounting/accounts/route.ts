import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { createAccountSubjectSchema } from '@/lib/validations/accounting'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = request.nextUrl
    const accountType = searchParams.get('accountType')
    const parentId = searchParams.get('parentId')
    const rawSearch = searchParams.get('search')

    const where: any = {}
    if (accountType) where.accountType = accountType
    if (parentId) where.parentId = parentId
    if (rawSearch) {
      const search = sanitizeSearchQuery(rawSearch)
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { nameKo: { contains: search, mode: 'insensitive' } },
      ]
    }

    const accounts = await prisma.accountSubject.findMany({
      where,
      include: {
        parent: { select: { code: true, nameKo: true } },
        _count: { select: { voucherDetails: true } },
      },
      orderBy: { code: 'asc' },
    })

    return successResponse(accounts)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createAccountSubjectSchema.parse(body)

    const existing = await prisma.accountSubject.findUnique({
      where: { code: data.code },
    })
    if (existing) {
      return errorResponse('이미 존재하는 계정코드입니다.', 'DUPLICATE')
    }

    const account = await prisma.accountSubject.create({
      data: {
        code: data.code,
        nameKo: data.nameKo,
        nameEn: data.nameEn,
        accountType: data.accountType,
        level: data.level,
        parentId: data.parentId ?? null,
        taxRelated: data.taxRelated,
      },
    })

    return successResponse(account)
  } catch (error) {
    return handleApiError(error)
  }
}

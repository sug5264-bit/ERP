import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return successResponse(companies)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const company = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.company.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }
      const created = await tx.company.create({
        data: {
          companyName: body.companyName,
          bizNo: body.bizNo || null,
          ceoName: body.ceoName || null,
          bizType: body.bizType || null,
          bizCategory: body.bizCategory || null,
          address: body.address || null,
          phone: body.phone || null,
          fax: body.fax || null,
          email: body.email || null,
          bankName: body.bankName || null,
          bankAccount: body.bankAccount || null,
          bankHolder: body.bankHolder || null,
          isDefault: body.isDefault || false,
        },
      })
      return created
    })

    return successResponse(company)
  } catch (error) {
    return handleApiError(error)
  }
}

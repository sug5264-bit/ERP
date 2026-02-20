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
    const company = await prisma.company.create({
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

    // If set as default, unset other defaults
    if (body.isDefault) {
      await prisma.company.updateMany({
        where: { id: { not: company.id } },
        data: { isDefault: false },
      })
    }

    return successResponse(company)
  } catch (error) {
    return handleApiError(error)
  }
}

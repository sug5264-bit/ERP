import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { successResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'

const createCompanySchema = z.object({
  companyName: z.string().min(1, '회사명은 필수입니다.').max(200),
  bizNo: z
    .string()
    .max(20)
    .regex(/^[0-9-]*$/, '사업자번호 형식이 올바르지 않습니다.')
    .nullable()
    .optional(),
  ceoName: z.string().max(100).nullable().optional(),
  bizType: z.string().max(100).nullable().optional(),
  bizCategory: z.string().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  fax: z.string().max(30).nullable().optional(),
  email: z.string().email('유효한 이메일을 입력하세요.').max(200).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  bankAccount: z.string().max(50).nullable().optional(),
  bankHolder: z.string().max(100).nullable().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET(_req: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

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
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const validated = createCompanySchema.parse(body)
    const company = await prisma.$transaction(async (tx) => {
      if (validated.isDefault) {
        await tx.company.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }
      const created = await tx.company.create({
        data: {
          companyName: validated.companyName,
          bizNo: validated.bizNo || null,
          ceoName: validated.ceoName || null,
          bizType: validated.bizType || null,
          bizCategory: validated.bizCategory || null,
          address: validated.address || null,
          phone: validated.phone || null,
          fax: validated.fax || null,
          email: validated.email || null,
          bankName: validated.bankName || null,
          bankAccount: validated.bankAccount || null,
          bankHolder: validated.bankHolder || null,
          isDefault: validated.isDefault || false,
        },
      })
      return created
    })

    return successResponse(company)
  } catch (error) {
    return handleApiError(error)
  }
}

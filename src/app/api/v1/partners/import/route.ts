import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse('업로드할 데이터가 없습니다.', 'EMPTY_DATA')
    }

    let success = 0
    let failed = 0
    const errors: { row: number; message: string }[] = []

    const typeMap: Record<string, string> = {
      '매출': 'SALES', '매입': 'PURCHASE', '매출/매입': 'BOTH',
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      try {
        if (!row.partnerCode || !row.partnerName) {
          throw new Error('거래처코드와 거래처명은 필수입니다.')
        }

        const existing = await prisma.partner.findUnique({ where: { partnerCode: row.partnerCode } })
        if (existing) {
          throw new Error(`거래처코드 '${row.partnerCode}'가 이미 존재합니다.`)
        }

        await prisma.partner.create({
          data: {
            partnerCode: String(row.partnerCode),
            partnerName: String(row.partnerName),
            partnerType: typeMap[row.partnerType] || row.partnerType || 'BOTH',
            bizNo: row.bizNo ? String(row.bizNo) : undefined,
            ceoName: row.ceoName ? String(row.ceoName) : undefined,
            bizType: row.bizType ? String(row.bizType) : undefined,
            bizCategory: row.bizCategory ? String(row.bizCategory) : undefined,
            phone: row.phone ? String(row.phone) : undefined,
            fax: row.fax ? String(row.fax) : undefined,
            email: row.email ? String(row.email) : undefined,
            address: row.address ? String(row.address) : undefined,
            contactPerson: row.contactPerson ? String(row.contactPerson) : undefined,
            creditLimit: row.creditLimit ? parseFloat(row.creditLimit) : undefined,
            paymentTerms: row.paymentTerms ? String(row.paymentTerms) : undefined,
          },
        })
        success++
      } catch (err: any) {
        failed++
        errors.push({ row: rowNum, message: err.message || '알 수 없는 오류' })
      }
    }

    return successResponse({ success, failed, errors })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult

    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse('업로드할 데이터가 없습니다.', 'EMPTY_DATA')
    }
    if (rows.length > 500) {
      return errorResponse('한 번에 최대 500건까지 업로드할 수 있습니다.', 'TOO_LARGE', 413)
    }

    let success = 0
    let failed = 0
    const errors: { row: number; message: string }[] = []

    const typeMap: Record<string, string> = {
      매출: 'SALES',
      매입: 'PURCHASE',
      '매출/매입': 'BOTH',
    }
    const channelMap: Record<string, string> = {
      온라인: 'ONLINE',
      오프라인: 'OFFLINE',
    }
    const VALID_TYPES = new Set(['SALES', 'PURCHASE', 'BOTH'])
    const VALID_CHANNELS = new Set(['ONLINE', 'OFFLINE'])
    const PARTNER_CODE_RE = /^[A-Za-z0-9-]{1,50}$/
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const BIZ_NO_RE = /^[\d-]{0,20}$/

    // 배치 중복 검사: N+1 쿼리 제거
    const allCodes = rows
      .filter((r: Record<string, unknown>) => r.partnerCode)
      .map((r: Record<string, unknown>) => String(r.partnerCode).trim())
    const existingPartners = await prisma.partner.findMany({
      where: { partnerCode: { in: allCodes } },
      select: { partnerCode: true },
    })
    const existingCodeSet = new Set(existingPartners.map((p) => p.partnerCode))

    /** 콤마 포함 숫자 문자열을 파싱 */
    function parseNumber(val: unknown): number {
      if (typeof val === 'number') return val
      return parseFloat(String(val).replace(/,/g, ''))
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      try {
        if (!row.partnerCode || !row.partnerName) {
          throw new Error('거래처코드와 거래처명은 필수입니다.')
        }

        const partnerCode = String(row.partnerCode).trim()
        if (!PARTNER_CODE_RE.test(partnerCode)) {
          throw new Error('거래처코드는 영문, 숫자, 하이픈만 사용 가능합니다 (최대 50자).')
        }

        const partnerName = String(row.partnerName).trim()
        if (partnerName.length > 200) {
          throw new Error('거래처명은 200자 이내여야 합니다.')
        }

        const mappedType = typeMap[row.partnerType] || row.partnerType || 'BOTH'
        if (!VALID_TYPES.has(mappedType)) {
          throw new Error(`유효하지 않은 거래처유형입니다: ${row.partnerType}`)
        }

        const mappedChannel = channelMap[row.salesChannel] || row.salesChannel || 'OFFLINE'
        if (!VALID_CHANNELS.has(mappedChannel)) {
          throw new Error(`유효하지 않은 채널입니다: ${row.salesChannel}`)
        }

        if (row.bizNo && !BIZ_NO_RE.test(String(row.bizNo))) {
          throw new Error('사업자번호 형식이 올바르지 않습니다.')
        }

        if (row.email && !EMAIL_RE.test(String(row.email))) {
          throw new Error('유효한 이메일 형식이 아닙니다.')
        }

        if (row.creditLimit !== undefined && row.creditLimit !== '') {
          const limit = parseNumber(row.creditLimit)
          if (isNaN(limit) || limit < 0) {
            throw new Error('신용한도는 0 이상의 숫자여야 합니다.')
          }
        }

        if (existingCodeSet.has(partnerCode)) {
          throw new Error(`거래처코드 '${partnerCode}'가 이미 존재합니다.`)
        }

        await prisma.partner.create({
          data: {
            partnerCode,
            partnerName,
            partnerType: mappedType,
            salesChannel: mappedChannel,
            bizNo: row.bizNo ? String(row.bizNo).trim() : undefined,
            ceoName: row.ceoName ? String(row.ceoName).trim().slice(0, 100) : undefined,
            bizType: row.bizType ? String(row.bizType).trim().slice(0, 100) : undefined,
            bizCategory: row.bizCategory ? String(row.bizCategory).trim().slice(0, 100) : undefined,
            phone: row.phone ? String(row.phone).trim().slice(0, 20) : undefined,
            fax: row.fax ? String(row.fax).trim().slice(0, 20) : undefined,
            email: row.email ? String(row.email).trim() : undefined,
            address: row.address ? String(row.address).trim().slice(0, 500) : undefined,
            contactPerson: row.contactPerson ? String(row.contactPerson).trim().slice(0, 100) : undefined,
            creditLimit: row.creditLimit ? parseNumber(row.creditLimit) : undefined,
            paymentTerms: row.paymentTerms ? String(row.paymentTerms).trim().slice(0, 100) : undefined,
            foodBizNo: row.foodBizNo ? String(row.foodBizNo).trim().slice(0, 50) : undefined,
            haccpNo: row.haccpNo ? String(row.haccpNo).trim().slice(0, 50) : undefined,
            factoryAddress: row.factoryAddress ? String(row.factoryAddress).trim().slice(0, 500) : undefined,
          },
        })
        existingCodeSet.add(partnerCode)
        success++
      } catch (err: unknown) {
        failed++
        errors.push({ row: rowNum, message: err instanceof Error ? err.message : '알 수 없는 오류' })
      }
    }

    return successResponse({ success, failed, errors })
  } catch (error) {
    return handleApiError(error)
  }
}

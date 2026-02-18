import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'
import { sanitizeSearchQuery } from '@/lib/sanitize'

/**
 * 글로벌 통합 검색 API
 * GET /api/v1/search?q=검색어&modules=hr,sales&limit=20
 *
 * 사원, 거래처, 품목, 전표, 프로젝트를 한번에 검색
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { searchParams } = req.nextUrl
    const rawQuery = searchParams.get('q')?.trim()
    if (!rawQuery || rawQuery.length < 2) {
      return errorResponse('검색어를 2글자 이상 입력해주세요.', 'VALIDATION_ERROR', 400)
    }

    const query = sanitizeSearchQuery(rawQuery)
    const modulesParam = searchParams.get('modules')
    const rawLimit = parseInt(searchParams.get('limit') || '5')
    const limit = Math.min(50, Number.isFinite(rawLimit) ? rawLimit : 5)
    const enabledModules = modulesParam
      ? modulesParam.split(',')
      : ['employee', 'partner', 'item', 'voucher', 'project']

    const results: Record<string, any[]> = {}

    const searches = []

    // 사원 검색
    if (enabledModules.includes('employee')) {
      searches.push(
        prisma.employee.findMany({
          where: {
            OR: [
              { nameKo: { contains: query, mode: 'insensitive' } },
              { employeeNo: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            employeeNo: true,
            nameKo: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
            status: true,
          },
          take: limit,
        }).then((data) => {
          results.employees = data.map((e) => ({
            id: e.id,
            type: 'employee',
            title: e.nameKo,
            subtitle: `${e.department?.name || ''} / ${e.position?.name || ''}`,
            badge: e.employeeNo,
            url: `/hr/employees/${e.id}`,
          }))
        })
      )
    }

    // 거래처 검색
    if (enabledModules.includes('partner')) {
      searches.push(
        prisma.partner.findMany({
          where: {
            OR: [
              { partnerName: { contains: query, mode: 'insensitive' } },
              { bizNo: { contains: query, mode: 'insensitive' } },
              { contactPerson: { contains: query, mode: 'insensitive' } },
              { partnerCode: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            partnerName: true,
            partnerType: true,
            partnerCode: true,
            contactPerson: true,
          },
          take: limit,
        }).then((data) => {
          results.partners = data.map((p) => ({
            id: p.id,
            type: 'partner',
            title: p.partnerName,
            subtitle: p.contactPerson || p.partnerCode || '',
            badge: p.partnerType,
            url: `/sales/partners/${p.id}`,
          }))
        })
      )
    }

    // 품목 검색
    if (enabledModules.includes('item')) {
      searches.push(
        prisma.item.findMany({
          where: {
            OR: [
              { itemName: { contains: query, mode: 'insensitive' } },
              { itemCode: { contains: query, mode: 'insensitive' } },
              { specification: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            itemCode: true,
            itemName: true,
            specification: true,
            category: { select: { name: true } },
          },
          take: limit,
        }).then((data) => {
          results.items = data.map((i) => ({
            id: i.id,
            type: 'item',
            title: i.itemName,
            subtitle: i.specification || i.category?.name || '',
            badge: i.itemCode,
            url: `/inventory/items/${i.id}`,
          }))
        })
      )
    }

    // 전표 검색
    if (enabledModules.includes('voucher')) {
      searches.push(
        prisma.voucher.findMany({
          where: {
            OR: [
              { voucherNo: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            voucherNo: true,
            voucherDate: true,
            description: true,
            status: true,
          },
          take: limit,
          orderBy: { voucherDate: 'desc' },
        }).then((data) => {
          results.vouchers = data.map((v) => ({
            id: v.id,
            type: 'voucher',
            title: v.voucherNo,
            subtitle: v.description || '',
            badge: v.status,
            url: `/accounting/vouchers/${v.id}`,
          }))
        })
      )
    }

    // 프로젝트 검색
    if (enabledModules.includes('project')) {
      searches.push(
        prisma.project.findMany({
          where: {
            OR: [
              { projectName: { contains: query, mode: 'insensitive' } },
              { projectCode: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            projectCode: true,
            projectName: true,
            status: true,
          },
          take: limit,
        }).then((data) => {
          results.projects = data.map((p) => ({
            id: p.id,
            type: 'project',
            title: p.projectName,
            subtitle: '',
            badge: p.projectCode,
            url: `/projects/${p.id}`,
          }))
        })
      )
    }

    await Promise.allSettled(searches)

    // 전체 결과 수 집계
    const totalCount = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)

    return successResponse({ results, totalCount, query })
  } catch (error) {
    return handleApiError(error)
  }
}

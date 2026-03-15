import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requireAuth,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}

    const search = sp.get('search')
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { companyCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const isActive = sp.get('isActive')
    if (isActive === 'true') where.isActive = true
    else if (isActive === 'false') where.isActive = false

    const [items, totalCount] = await Promise.all([
      prisma.shipperCompany.findMany({
        where,
        include: {
          _count: {
            select: {
              shipperOrders: {
                where: {
                  status: { notIn: ['DELIVERED', 'RETURNED'] },
                },
              },
            },
          },
          users: {
            where: { accountType: 'SHIPPER' },
            select: { id: true, username: true, email: true, name: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.shipperCompany.count({ where }),
    ])

    const data = items.map((item) => ({
      ...item,
      activeOrderCount: item._count.shipperOrders,
      account: item.users[0] || null,
      _count: undefined,
      users: undefined,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()

    if (!body.companyName || typeof body.companyName !== 'string' || body.companyName.trim() === '') {
      return errorResponse('화주사명은 필수입니다.', 'VALIDATION_ERROR', 400)
    }

    // Auto-generate companyCode as "SHP-XXXX"
    const lastCompany = await prisma.shipperCompany.findFirst({
      where: { companyCode: { startsWith: 'SHP-' } },
      orderBy: { companyCode: 'desc' },
      select: { companyCode: true },
    })

    let nextNumber = 1
    if (lastCompany) {
      const lastNumber = parseInt(lastCompany.companyCode.replace('SHP-', ''), 10)
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1
    }
    const companyCode = `SHP-${String(nextNumber).padStart(4, '0')}`

    // Check uniqueness (in case of manual codes)
    if (body.companyCode) {
      const existing = await prisma.shipperCompany.findUnique({
        where: { companyCode: body.companyCode },
      })
      if (existing) {
        return errorResponse('이미 존재하는 화주사 코드입니다.', 'DUPLICATE_CODE', 400)
      }
    }

    // 계정 정보 검증 (선택사항 - 제공되면 계정 함께 생성)
    const createAccount = body.username && body.password
    if (createAccount) {
      if (body.username.length < 3) {
        return errorResponse('아이디는 3자 이상이어야 합니다.', 'VALIDATION_ERROR', 400)
      }
      if (body.password.length < 4) {
        return errorResponse('비밀번호는 4자 이상이어야 합니다.', 'VALIDATION_ERROR', 400)
      }
      const existingUser = await prisma.user.findUnique({
        where: { username: body.username },
      })
      if (existingUser) {
        return errorResponse('이미 존재하는 아이디입니다.', 'DUPLICATE_USERNAME', 409)
      }
      if (body.accountEmail) {
        const existingEmail = await prisma.user.findUnique({
          where: { email: body.accountEmail },
        })
        if (existingEmail) {
          return errorResponse('이미 존재하는 이메일입니다.', 'DUPLICATE_EMAIL', 409)
        }
      }
    }

    // 트랜잭션: 화주사 + 계정 동시 생성
    const result = await prisma.$transaction(async (tx) => {
      const shipper = await tx.shipperCompany.create({
        data: {
          companyCode: body.companyCode || companyCode,
          companyName: body.companyName.trim(),
          bizNo: body.bizNo || null,
          ceoName: body.ceoName || null,
          phone: body.phone || null,
          email: body.email || null,
          address: body.address || null,
          contractStart: body.contractStart ? new Date(body.contractStart) : null,
          contractEnd: body.contractEnd ? new Date(body.contractEnd) : null,
          monthlyFee: body.monthlyFee ?? null,
          isActive: body.isActive ?? true,
          contactName: body.contactName || null,
          contactPhone: body.contactPhone || null,
          contactEmail: body.contactEmail || null,
          contractType: body.contractType || 'STANDARD',
          paymentTerms: body.paymentTerms || 'POSTPAID',
          billingCycle: body.billingCycle || 'MONTHLY',
          memo: body.memo || null,
        },
      })

      let account = null
      if (createAccount) {
        const passwordHash = await hash(body.password, 12)
        account = await tx.user.create({
          data: {
            username: body.username,
            email: body.accountEmail || `${body.username}@shipper.local`,
            passwordHash,
            name: body.accountName || body.companyName.trim(),
            accountType: 'SHIPPER',
            shipperId: shipper.id,
          },
          select: { id: true, username: true, email: true, name: true, accountType: true },
        })
      }

      return { ...shipper, account }
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

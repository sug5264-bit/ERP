import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'
import bcrypt from 'bcryptjs'

/**
 * POST /api/v1/admin/setup-shipper
 * 관리자 전용: 화주사(SHIPPER) 테스트 계정 생성
 */
export async function POST() {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const username = 'shipper01'

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return successResponse({
        message: '화주사 계정이 이미 존재합니다.',
        username,
        accountType: existing.accountType,
      })
    }

    const passwordHash = await bcrypt.hash('shipper1234', 10)
    const user = await prisma.user.create({
      data: {
        username,
        email: 'shipper@test.co.kr',
        passwordHash,
        name: '테스트화주',
        accountType: 'SHIPPER',
        isActive: true,
      },
    })

    return successResponse({
      message: '화주사 계정 생성 완료',
      username: user.username,
      password: 'shipper1234',
      accountType: user.accountType,
      loginUrl: '/login → /shipper/dashboard',
    })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

export async function GET(_req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const userId = authResult.session.user.id

    // 사용자 + 사원 정보
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        lastLoginAt: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            employeeNo: true,
            nameKo: true,
            nameEn: true,
            phone: true,
            email: true,
            joinDate: true,
            employeeType: true,
            status: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
      },
    })

    if (!user) return errorResponse('사용자 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const employeeId = user.employee?.id
    const yearStart = new Date(new Date().getFullYear(), 0, 1)

    // 모든 독립 쿼리를 병렬 실행 (순차 5개 → 병렬 1번)
    const [leaveBalances, myApprovals, myLeaves, recentNotifications, loginHistory] = await Promise.all([
      employeeId
        ? prisma.leaveBalance.findMany({
            where: { employeeId, year: new Date().getFullYear() },
          })
        : [],
      employeeId
        ? prisma.approvalDocument.findMany({
            where: { drafterId: employeeId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              documentNo: true,
              title: true,
              status: true,
              currentStep: true,
              totalSteps: true,
              draftDate: true,
            },
          })
        : [],
      employeeId
        ? prisma.leave.findMany({
            where: { employeeId, startDate: { gte: yearStart } },
            orderBy: { startDate: 'desc' },
            take: 10,
          })
        : [],
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.auditLog.findMany({
        where: { userId, action: 'LOGIN' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, ipAddress: true, createdAt: true },
      }),
    ])

    return successResponse({
      user,
      leaveBalances,
      myApprovals,
      myLeaves,
      recentNotifications,
      loginHistory,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// 비밀번호 변경 Rate Limiting (사용자별, 시간당 5회)
const passwordChangeRateMap = new Map<string, { count: number; resetAt: number }>()
const PASSWORD_CHANGE_LIMIT = 5
const PASSWORD_CHANGE_WINDOW = 60 * 60 * 1000 // 1시간
const MAX_RATE_ENTRIES = 500
let lastRateCleanup = Date.now()

function checkPasswordChangeRate(userId: string): boolean {
  const now = Date.now()
  // 5분마다 만료 엔트리 정리 (메모리 누수 방지)
  if (now - lastRateCleanup > 5 * 60 * 1000) {
    lastRateCleanup = now
    for (const [key, val] of passwordChangeRateMap) {
      if (val.resetAt < now) passwordChangeRateMap.delete(key)
    }
  }
  // 최대 엔트리 수 제한
  if (passwordChangeRateMap.size >= MAX_RATE_ENTRIES) {
    const firstKey = passwordChangeRateMap.keys().next().value
    if (firstKey) passwordChangeRateMap.delete(firstKey)
  }
  const entry = passwordChangeRateMap.get(userId)
  if (!entry || entry.resetAt < now) {
    passwordChangeRateMap.set(userId, { count: 1, resetAt: now + PASSWORD_CHANGE_WINDOW })
    return true
  }
  entry.count += 1
  return entry.count <= PASSWORD_CHANGE_LIMIT
}

// PUT: 비밀번호 변경
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const { action } = body

    if (action === 'changePassword') {
      const userId = authResult.session.user.id

      // Rate limiting: 비밀번호 변경은 시간당 5회로 제한
      if (!checkPasswordChangeRate(userId)) {
        return errorResponse('비밀번호 변경 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.', 'RATE_LIMIT', 429)
      }

      const { currentPassword, newPassword } = body
      if (!currentPassword || !newPassword) {
        return errorResponse('현재 비밀번호와 새 비밀번호를 입력하세요.', 'BAD_REQUEST', 400)
      }
      if (newPassword.length < 8 || newPassword.length > 72) {
        return errorResponse('비밀번호는 8자 이상 72자 이하여야 합니다.', 'BAD_REQUEST', 400)
      }
      if (
        !/[A-Za-z]/.test(newPassword) ||
        !/\d/.test(newPassword) ||
        !/[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~]/.test(newPassword)
      ) {
        return errorResponse('비밀번호는 영문, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.', 'BAD_REQUEST', 400)
      }
      if (currentPassword === newPassword) {
        return errorResponse('새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'BAD_REQUEST', 400)
      }

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) return errorResponse('사용자를 찾을 수 없습니다.', 'NOT_FOUND', 404)

      const bcrypt = await import('bcryptjs')
      const valid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!valid) return errorResponse('현재 비밀번호가 일치하지 않습니다.', 'INVALID_PASSWORD', 400)

      const hash = await bcrypt.hash(newPassword, 12)
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } })

      return successResponse({ updated: true })
    }

    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION', 400)
  } catch (error) {
    return handleApiError(error)
  }
}

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

    const userId = session.user!.id!

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

    // 휴가 잔여 (LeaveBalance)
    let leaveBalances: any[] = []
    if (user.employee) {
      leaveBalances = await prisma.leaveBalance.findMany({
        where: { employeeId: user.employee.id, year: new Date().getFullYear() },
      })
    }

    // 내 결재 문서 (최근 10건)
    let myApprovals: any[] = []
    if (user.employee) {
      myApprovals = await prisma.approvalDocument.findMany({
        where: { drafterId: user.employee.id },
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
    }

    // 내 휴가 내역 (올해)
    let myLeaves: any[] = []
    if (user.employee) {
      const yearStart = new Date(new Date().getFullYear(), 0, 1)
      myLeaves = await prisma.leave.findMany({
        where: {
          employeeId: user.employee.id,
          startDate: { gte: yearStart },
        },
        orderBy: { startDate: 'desc' },
        take: 10,
      })
    }

    // 내게 온 알림 (최근 5건)
    const recentNotifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // 로그인 이력 (최근 10건)
    const loginHistory = await prisma.auditLog.findMany({
      where: { userId, action: 'LOGIN' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, ipAddress: true, createdAt: true },
    })

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

// PUT: 비밀번호 변경
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const { action } = body

    if (action === 'changePassword') {
      const { currentPassword, newPassword } = body
      if (!currentPassword || !newPassword) {
        return errorResponse('현재 비밀번호와 새 비밀번호를 입력하세요.', 'BAD_REQUEST', 400)
      }
      if (newPassword.length < 8) {
        return errorResponse('비밀번호는 8자 이상이어야 합니다.', 'BAD_REQUEST', 400)
      }

      const user = await prisma.user.findUnique({ where: { id: session.user!.id! } })
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

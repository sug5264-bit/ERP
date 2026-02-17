import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'
import { writeAuditLog, createNotification } from '@/lib/audit-log'

// POST: 일괄 휴가 승인/반려
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const { ids, action } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse('처리할 휴가를 선택하세요.', 'BAD_REQUEST', 400)
    }
    if (!['approve', 'reject'].includes(action)) {
      return errorResponse('유효하지 않은 작업입니다.', 'BAD_REQUEST', 400)
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    let successCount = 0
    let failCount = 0

    for (const leaveId of ids) {
      try {
        const leave = await prisma.leave.findUnique({
          where: { id: leaveId },
          include: { employee: { include: { user: true } } },
        })

        if (!leave || leave.status !== 'REQUESTED') {
          failCount++
          continue
        }

        await prisma.leave.update({
          where: { id: leaveId },
          data: { status: newStatus },
        })

        // 감사 로그
        await writeAuditLog({
          action: action === 'approve' ? 'APPROVE' : 'REJECT',
          tableName: 'leaves',
          recordId: leaveId,
        })

        // 알림
        if (leave.employee?.user) {
          const actionLabel = action === 'approve' ? '승인' : '반려'
          await createNotification({
            userId: leave.employee.user.id,
            type: 'LEAVE',
            title: `휴가 ${actionLabel}`,
            message: `신청하신 휴가가 ${actionLabel}되었습니다.`,
            relatedUrl: '/hr/leave',
          })
        }

        successCount++
      } catch {
        failCount++
      }
    }

    return successResponse({ successCount, failCount })
  } catch (error) {
    return handleApiError(error)
  }
}

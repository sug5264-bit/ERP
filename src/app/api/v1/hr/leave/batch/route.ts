import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { writeAuditLog, createNotification } from '@/lib/audit-log'

// POST: 일괄 휴가 승인/반려
export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'update')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const { ids, action } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse('처리할 휴가를 선택하세요.', 'BAD_REQUEST', 400)
    }
    if (!['approve', 'reject'].includes(action)) {
      return errorResponse('유효하지 않은 작업입니다.', 'BAD_REQUEST', 400)
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    const actionLabel = action === 'approve' ? '승인' : '반려'
    let successCount = 0
    let failCount = 0

    // 일괄 조회로 N+1 제거
    const leaves = await prisma.leave.findMany({
      where: { id: { in: ids }, status: 'REQUESTED' },
      include: { employee: { include: { user: true } } },
    })
    const leaveMap = new Map(leaves.map((l) => [l.id, l]))

    for (const leaveId of ids) {
      try {
        const leave = leaveMap.get(leaveId)
        if (!leave) {
          failCount++
          continue
        }

        await prisma.$transaction(async (tx) => {
          await tx.leave.update({
            where: { id: leaveId },
            data: { status: newStatus },
          })

          // 승인 시 LeaveBalance 업데이트 (잔여일 검증 포함)
          if (newStatus === 'APPROVED') {
            const year = new Date(leave.startDate).getFullYear()
            const balance = await tx.leaveBalance.findFirst({
              where: { employeeId: leave.employeeId, year },
            })
            if (!balance) {
              throw new Error('해당 연도의 휴가 잔여일 정보가 없습니다.')
            }
            if (Number(balance.remainingDays) < Number(leave.days)) {
              throw new Error(`잔여 휴가일수(${balance.remainingDays}일)가 부족합니다.`)
            }
            await tx.leaveBalance.updateMany({
              where: { employeeId: leave.employeeId, year },
              data: {
                usedDays: { increment: Number(leave.days) },
                remainingDays: { decrement: Number(leave.days) },
              },
            })
          }
        })

        // 감사 로그 + 알림 병렬 실행
        const tasks: Promise<any>[] = [
          writeAuditLog({
            action: action === 'approve' ? 'APPROVE' : 'REJECT',
            tableName: 'leaves',
            recordId: leaveId,
          }),
        ]
        if (leave.employee?.user) {
          tasks.push(
            createNotification({
              userId: leave.employee.user.id,
              type: 'LEAVE',
              title: `휴가 ${actionLabel}`,
              message: `신청하신 휴가가 ${actionLabel}되었습니다.`,
              relatedUrl: '/hr/leave',
            })
          )
        }
        await Promise.all(tasks)

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

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'
import { writeAuditLog, createNotification } from '@/lib/audit-log'

// POST: 일괄 결재 처리 (승인/반려)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const { ids, action, comment } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse('처리할 문서를 선택하세요.', 'BAD_REQUEST', 400)
    }
    if (!['approve', 'reject'].includes(action)) {
      return errorResponse('유효하지 않은 작업입니다.', 'BAD_REQUEST', 400)
    }

    const employee = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    // 일괄 조회로 N+1 쿼리 제거 (ids.length번 → 1번 쿼리)
    const docs = await prisma.approvalDocument.findMany({
      where: { id: { in: ids } },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, drafter: { include: { user: true } } },
    })
    const docMap = new Map(docs.map((d) => [d.id, d]))

    for (const docId of ids) {
      try {
        const doc = docMap.get(docId)
        if (!doc) { failCount++; errors.push(`문서 ${docId}: 찾을 수 없음`); continue }

        const currentStepData = doc.steps.find(
          (s) => s.stepOrder === doc.currentStep && s.approverId === employee.id
        )

        if (!currentStepData) { failCount++; errors.push(`문서 ${doc.documentNo}: 결재 권한 없음`); continue }

        // 결재 단계 + 문서 상태 + 감사로그 + 알림을 병렬 실행
        const docStatus = action === 'reject'
          ? 'REJECTED' as const
          : doc.currentStep >= doc.totalSteps
            ? 'APPROVED' as const
            : null

        const actionLabel = action === 'approve' ? '승인' : '반려'

        await Promise.all([
          prisma.approvalStep.update({
            where: { id: currentStepData.id },
            data: {
              status: action === 'approve' ? 'APPROVED' : 'REJECTED',
              comment: comment || null,
              actionDate: new Date(),
            },
          }),
          docStatus
            ? prisma.approvalDocument.update({ where: { id: docId }, data: { status: docStatus } })
            : prisma.approvalDocument.update({ where: { id: docId }, data: { currentStep: doc.currentStep + 1 } }),
          writeAuditLog({
            action: action === 'approve' ? 'APPROVE' : 'REJECT',
            tableName: 'approval_documents',
            recordId: docId,
          }),
          doc.drafter?.user
            ? createNotification({
                userId: doc.drafter.user.id,
                type: 'APPROVAL',
                title: `결재 ${actionLabel}`,
                message: `"${doc.title}" 문서가 ${actionLabel}되었습니다.`,
                relatedUrl: `/approval/${action === 'approve' ? 'completed' : 'rejected'}`,
              })
            : Promise.resolve(),
        ])

        successCount++
      } catch (err) {
        failCount++
        errors.push(`문서 ${docId}: 처리 오류`)
      }
    }

    return successResponse({
      successCount,
      failCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

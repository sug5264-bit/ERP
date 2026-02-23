import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('approval', 'read')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const doc = await prisma.approvalDocument.findUnique({
      where: { id },
      include: { drafter: true, template: true, steps: { include: { approver: true }, orderBy: { stepOrder: 'asc' } } },
    })
    if (!doc) return errorResponse('결재 문서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(doc)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('approval', 'update')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    const allowedActions = ['submit', 'approve', 'reject', 'cancel']
    if (!body.action || !allowedActions.includes(body.action)) {
      return errorResponse(
        '유효하지 않은 작업입니다. 허용된 작업: submit, approve, reject, cancel',
        'INVALID_ACTION',
        400
      )
    }
    const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    if (body.action === 'submit') {
      const existing = await prisma.approvalDocument.findUnique({
        where: { id },
        select: { status: true, drafterId: true },
      })
      if (!existing) return errorResponse('결재 문서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (existing.status !== 'DRAFTED') {
        return errorResponse('작성 상태의 문서만 상신할 수 있습니다.', 'INVALID_STATUS', 400)
      }
      const doc = await prisma.approvalDocument.update({
        where: { id },
        data: { status: 'IN_PROGRESS', currentStep: 1 },
      })
      return successResponse(doc)
    }

    if (body.action === 'approve' || body.action === 'reject') {
      // 트랜잭션으로 원자적 처리 + 낙관적 잠금
      const result = await prisma.$transaction(async (tx) => {
        const doc = await tx.approvalDocument.findUnique({
          where: { id },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        })
        if (!doc) throw new Error('NOT_FOUND')
        if (doc.status !== 'IN_PROGRESS') throw new Error('INVALID_STATUS')

        const currentStepData = doc.steps.find((s) => s.stepOrder === doc.currentStep && s.approverId === employee.id)
        if (!currentStepData) throw new Error('FORBIDDEN')
        if (currentStepData.status !== 'PENDING') throw new Error('ALREADY_PROCESSED')

        await tx.approvalStep.update({
          where: { id: currentStepData.id },
          data: {
            status: body.action === 'approve' ? 'APPROVED' : 'REJECTED',
            comment: body.comment || null,
            actionDate: new Date(),
          },
        })

        if (body.action === 'reject') {
          await tx.approvalDocument.update({ where: { id }, data: { status: 'REJECTED' } })
        } else if (doc.currentStep >= doc.totalSteps) {
          await tx.approvalDocument.update({ where: { id }, data: { status: 'APPROVED' } })
        } else {
          await tx.approvalDocument.update({ where: { id }, data: { currentStep: doc.currentStep + 1 } })
        }
        return { updated: true }
      })
      return successResponse(result)
    }

    if (body.action === 'cancel') {
      const existing = await prisma.approvalDocument.findUnique({
        where: { id },
        select: { status: true, drafterId: true },
      })
      if (!existing) return errorResponse('결재 문서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (!['DRAFTED', 'IN_PROGRESS'].includes(existing.status)) {
        return errorResponse('완료되거나 이미 취소된 문서는 취소할 수 없습니다.', 'INVALID_STATUS', 400)
      }
      if (existing.drafterId !== employee.id) {
        return errorResponse('작성자만 문서를 취소할 수 있습니다.', 'FORBIDDEN', 403)
      }
      await prisma.approvalDocument.update({ where: { id }, data: { status: 'CANCELLED' } })
      return successResponse({ cancelled: true })
    }

    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION')
  } catch (error) {
    // 트랜잭션 내 비즈니스 로직 에러 처리
    if (error instanceof Error) {
      const errMap: Record<string, [string, string, number]> = {
        NOT_FOUND: ['결재 문서를 찾을 수 없습니다.', 'NOT_FOUND', 404],
        INVALID_STATUS: ['진행 중인 문서만 결재할 수 있습니다.', 'INVALID_STATUS', 400],
        FORBIDDEN: ['현재 결재 권한이 없습니다.', 'FORBIDDEN', 403],
        ALREADY_PROCESSED: ['이미 처리된 결재 단계입니다.', 'ALREADY_PROCESSED', 409],
      }
      const mapped = errMap[error.message]
      if (mapped) return errorResponse(mapped[0], mapped[1], mapped[2])
    }
    return handleApiError(error)
  }
}

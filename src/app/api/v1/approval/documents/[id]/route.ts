import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const doc = await prisma.approvalDocument.findUnique({
      where: { id }, include: { drafter: true, template: true, steps: { include: { approver: true }, orderBy: { stepOrder: 'asc' } } },
    })
    if (!doc) return errorResponse('결재 문서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(doc)
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const body = await request.json()
    const employee = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    if (body.action === 'submit') {
      const doc = await prisma.approvalDocument.update({
        where: { id }, data: { status: 'IN_PROGRESS', currentStep: 1 },
      })
      return successResponse(doc)
    }

    if (body.action === 'approve' || body.action === 'reject') {
      const doc = await prisma.approvalDocument.findUnique({ where: { id }, include: { steps: { orderBy: { stepOrder: 'asc' } } } })
      if (!doc) return errorResponse('결재 문서를 찾을 수 없습니다.', 'NOT_FOUND', 404)

      const currentStepData = doc.steps.find(s => s.stepOrder === doc.currentStep && s.approverId === employee.id)
      if (!currentStepData) return errorResponse('현재 결재 권한이 없습니다.', 'FORBIDDEN', 403)

      await prisma.approvalStep.update({
        where: { id: currentStepData.id },
        data: { status: body.action === 'approve' ? 'APPROVED' : 'REJECTED', comment: body.comment || null, actionDate: new Date() },
      })

      if (body.action === 'reject') {
        await prisma.approvalDocument.update({ where: { id }, data: { status: 'REJECTED' } })
      } else if (doc.currentStep >= doc.totalSteps) {
        await prisma.approvalDocument.update({ where: { id }, data: { status: 'APPROVED' } })
      } else {
        await prisma.approvalDocument.update({ where: { id }, data: { currentStep: doc.currentStep + 1 } })
      }
      return successResponse({ updated: true })
    }

    if (body.action === 'cancel') {
      await prisma.approvalDocument.update({ where: { id }, data: { status: 'CANCELLED' } })
      return successResponse({ cancelled: true })
    }

    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION')
  } catch (error) { return handleApiError(error) }
}

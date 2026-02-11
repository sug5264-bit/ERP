import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createApprovalDocumentSchema } from '@/lib/validations/approval'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: any = {}
    const status = sp.get('status')
    if (status) where.status = status
    const drafterId = sp.get('drafterId')
    if (drafterId) where.drafterId = drafterId
    const myDrafts = sp.get('myDrafts')
    if (myDrafts === 'true') {
      const emp = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
      if (emp) where.drafterId = emp.id
    }
    const myApprovals = sp.get('myApprovals')
    if (myApprovals === 'true') {
      const emp = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
      if (emp) where.steps = { some: { approverId: emp.id } }
    }
    const [items, totalCount] = await Promise.all([
      prisma.approvalDocument.findMany({
        where, include: { drafter: true, template: true, steps: { include: { approver: true }, orderBy: { stepOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.approvalDocument.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createApprovalDocumentSchema.parse(body)

    const employee = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const documentNo = await generateDocumentNumber('APR', new Date(data.draftDate))

    const doc = await prisma.approvalDocument.create({
      data: {
        documentNo, templateId: data.templateId || null,
        title: data.title, content: data.content || null,
        drafterId: employee.id, draftDate: new Date(data.draftDate),
        totalSteps: data.steps.length, urgency: data.urgency,
        relatedModule: data.relatedModule || null, relatedDocId: data.relatedDocId || null,
        steps: {
          create: data.steps.map((s, idx) => ({
            stepOrder: idx + 1, approverId: s.approverId, approvalType: s.approvalType,
          })),
        },
      },
      include: { drafter: true, steps: { include: { approver: true }, orderBy: { stepOrder: 'asc' } } },
    })
    return successResponse(doc)
  } catch (error) { return handleApiError(error) }
}

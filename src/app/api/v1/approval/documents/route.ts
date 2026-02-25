import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createApprovalDocumentSchema } from '@/lib/validations/approval'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('approval', 'read')
    if (isErrorResponse(authResult)) return authResult
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: any = {}
    const status = sp.get('status')
    if (status) where.status = status
    const drafterId = sp.get('drafterId')
    if (drafterId) where.drafterId = drafterId

    // filter 파라미터 통합 지원
    const filter = sp.get('filter')
    const isMyDrafts = sp.get('myDrafts') === 'true' || filter === 'myDrafts'
    const isMyApprovals = sp.get('myApprovals') === 'true' || filter === 'myApprovals'

    let employeeId: string | null = null
    if (isMyDrafts || isMyApprovals) {
      const emp = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
      employeeId = emp?.id || null
    }

    if (isMyDrafts && employeeId) {
      where.drafterId = employeeId
    }

    if (isMyApprovals && employeeId) {
      // 결재 대기: IN_PROGRESS 상태이고, 현재 결재 차례(currentStep == stepOrder)인 문서만
      where.status = 'IN_PROGRESS'
      where.steps = {
        some: {
          approverId: employeeId,
          status: 'PENDING',
        },
      }
    }

    const includeFields = {
      drafter: {
        select: {
          id: true,
          nameKo: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
      template: { select: { id: true, templateName: true } },
      steps: {
        include: { approver: { select: { id: true, nameKo: true, position: { select: { name: true } } } } },
        orderBy: { stepOrder: 'asc' as const },
      },
    }

    // myApprovals: raw query로 currentStep == stepOrder 조건을 DB에서 처리 (LIMIT/OFFSET 포함)
    if (isMyApprovals && employeeId) {
      const [countResult, docIds] = await Promise.all([
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(DISTINCT ad.id) as count FROM approval_documents ad
          JOIN approval_steps ast ON ast."documentId" = ad.id
          WHERE ad.status = 'IN_PROGRESS'
            AND ast."approverId" = ${employeeId}
            AND ast.status = 'PENDING'
            AND ast."stepOrder" = ad."currentStep"
        `,
        prisma.$queryRaw<{ id: string }[]>`
          SELECT ad.id FROM approval_documents ad
          JOIN approval_steps ast ON ast."documentId" = ad.id
          WHERE ad.status = 'IN_PROGRESS'
            AND ast."approverId" = ${employeeId}
            AND ast.status = 'PENDING'
            AND ast."stepOrder" = ad."currentStep"
          ORDER BY ad."createdAt" DESC
          LIMIT ${pageSize} OFFSET ${skip}
        `,
      ])
      const totalCount = Number(countResult[0]?.count || 0)
      const ids = docIds.map((d) => d.id)
      const items = ids.length > 0
        ? await prisma.approvalDocument.findMany({
            where: { id: { in: ids } },
            include: includeFields,
            orderBy: { createdAt: 'desc' },
          })
        : []
      return successResponse(items, buildMeta(page, pageSize, totalCount))
    }

    const [items, totalCount] = await Promise.all([
      prisma.approvalDocument.findMany({
        where,
        include: includeFields,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.approvalDocument.count({ where }),
    ])

    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('approval', 'create')
    if (isErrorResponse(authResult)) return authResult
    const body = await request.json()
    const data = createApprovalDocumentSchema.parse(body)

    const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const documentNo = await generateDocumentNumber('APR', new Date(data.draftDate))

    const doc = await prisma.approvalDocument.create({
      data: {
        documentNo,
        templateId: data.templateId || null,
        title: data.title,
        content: data.content || null,
        drafterId: employee.id,
        draftDate: new Date(data.draftDate),
        totalSteps: data.steps.length,
        urgency: data.urgency,
        relatedModule: data.relatedModule || null,
        relatedDocId: data.relatedDocId || null,
        steps: {
          create: data.steps.map((s, idx) => ({
            stepOrder: idx + 1,
            approverId: s.approverId,
            approvalType: s.approvalType,
          })),
        },
      },
      include: { drafter: true, steps: { include: { approver: true }, orderBy: { stepOrder: 'asc' } } },
    })
    return successResponse(doc)
  } catch (error) {
    return handleApiError(error)
  }
}

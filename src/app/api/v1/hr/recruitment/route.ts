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

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = req.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) where.status = status

    const [items, totalCount] = await Promise.all([
      prisma.recruitment.findMany({
        where,
        include: {
          applicants: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.recruitment.count({ where }),
    ])

    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const { title, departmentId, positionId, description, requiredCount, startDate, endDate } = body

    if (!title || !departmentId || !positionId || !startDate || !endDate) {
      return errorResponse('필수 항목을 입력하세요.', 'BAD_REQUEST', 400)
    }

    const recruitment = await prisma.recruitment.create({
      data: {
        title,
        departmentId,
        positionId,
        description: description || null,
        requiredCount: requiredCount || 1,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    })

    return successResponse(recruitment)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'update')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) return errorResponse('ID가 필요합니다.', 'BAD_REQUEST', 400)

    // 상태 변경 액션
    if (action === 'close') {
      const updated = await prisma.recruitment.update({
        where: { id },
        data: { status: 'CLOSED' },
      })
      return successResponse(updated)
    }

    // 지원자 추가
    if (action === 'addApplicant') {
      const { name, email, phone, note } = updateData
      if (!name || !email) return errorResponse('이름과 이메일은 필수입니다.', 'BAD_REQUEST', 400)
      const applicant = await prisma.applicant.create({
        data: { recruitmentId: id, name, email, phone: phone || null, note: note || null },
      })
      return successResponse(applicant)
    }

    // 지원자 상태 변경
    if (action === 'updateApplicant') {
      const { applicantId, status } = updateData
      if (!applicantId || !status) return errorResponse('지원자 ID와 상태가 필요합니다.', 'BAD_REQUEST', 400)
      const updated = await prisma.applicant.update({
        where: { id: applicantId },
        data: { status },
      })
      return successResponse(updated)
    }

    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION', 400)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = req.nextUrl
    const id = searchParams.get('id')
    if (!id) return errorResponse('ID가 필요합니다.', 'BAD_REQUEST', 400)

    await prisma.applicant.deleteMany({ where: { recruitmentId: id } })
    await prisma.recruitment.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}

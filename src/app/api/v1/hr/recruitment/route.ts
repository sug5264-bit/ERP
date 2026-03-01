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

    const where: Record<string, unknown> = {}
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

    // 채용 인원 수 검증
    const parsedCount = Number(requiredCount) || 1
    if (parsedCount < 1 || parsedCount > 1000 || !Number.isInteger(parsedCount)) {
      return errorResponse('채용 인원은 1~1000 사이의 정수여야 합니다.', 'BAD_REQUEST', 400)
    }

    // 종료일이 시작일 이후인지 확인
    const sd = new Date(startDate)
    const ed = new Date(endDate)
    if (isNaN(sd.getTime()) || isNaN(ed.getTime())) {
      return errorResponse('유효하지 않은 날짜 형식입니다.', 'BAD_REQUEST', 400)
    }
    if (ed < sd) {
      return errorResponse('종료일은 시작일 이후여야 합니다.', 'BAD_REQUEST', 400)
    }

    const recruitment = await prisma.recruitment.create({
      data: {
        title,
        departmentId,
        positionId,
        description: description || null,
        requiredCount: parsedCount,
        startDate: sd,
        endDate: ed,
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
      // 유효한 지원자 상태값 검증
      const validStatuses = ['APPLIED', 'REVIEWING', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED']
      if (!validStatuses.includes(status)) {
        return errorResponse(`유효하지 않은 상태입니다. 허용: ${validStatuses.join(', ')}`, 'BAD_REQUEST', 400)
      }
      // 해당 채용공고에 속한 지원자인지 확인
      const applicant = await prisma.applicant.findFirst({
        where: { id: applicantId, recruitmentId: id },
      })
      if (!applicant) return errorResponse('해당 채용공고의 지원자를 찾을 수 없습니다.', 'NOT_FOUND', 404)
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

    await prisma.$transaction(async (tx) => {
      await tx.applicant.deleteMany({ where: { recruitmentId: id } })
      await tx.recruitment.delete({ where: { id } })
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}

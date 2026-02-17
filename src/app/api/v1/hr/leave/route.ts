import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLeaveSchema } from '@/lib/validations/hr'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { searchParams } = req.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status

    const [leaves, totalCount] = await Promise.all([
      prisma.leave.findMany({
        where,
        include: {
          employee: {
            select: {
              employeeNo: true, nameKo: true,
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.leave.count({ where }),
    ])

    return successResponse(leaves, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const validated = createLeaveSchema.parse(body)

    const leave = await prisma.leave.create({
      data: {
        employeeId: validated.employeeId,
        leaveType: validated.leaveType,
        startDate: new Date(validated.startDate),
        endDate: new Date(validated.endDate),
        days: validated.days,
        reason: validated.reason,
      },
      include: {
        employee: { select: { nameKo: true } },
      },
    })

    return successResponse(leave)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const { id, action } = body

    if (!id) return errorResponse('휴가 ID가 필요합니다.', 'BAD_REQUEST', 400)
    if (!['approve', 'reject', 'cancel'].includes(action)) {
      return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION', 400)
    }

    const leave = await prisma.leave.findUnique({ where: { id } })
    if (!leave) return errorResponse('휴가 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    if (action === 'approve') {
      if (leave.status !== 'REQUESTED') {
        return errorResponse('대기 상태의 휴가만 승인할 수 있습니다.', 'BAD_REQUEST', 400)
      }
      const updated = await prisma.leave.update({
        where: { id },
        data: { status: 'APPROVED' },
        include: { employee: { select: { nameKo: true } } },
      })
      return successResponse(updated)
    }

    if (action === 'reject') {
      if (leave.status !== 'REQUESTED') {
        return errorResponse('대기 상태의 휴가만 반려할 수 있습니다.', 'BAD_REQUEST', 400)
      }
      const updated = await prisma.leave.update({
        where: { id },
        data: { status: 'REJECTED' },
        include: { employee: { select: { nameKo: true } } },
      })
      return successResponse(updated)
    }

    if (action === 'cancel') {
      if (!['REQUESTED', 'APPROVED'].includes(leave.status)) {
        return errorResponse('취소할 수 없는 상태입니다.', 'BAD_REQUEST', 400)
      }
      const updated = await prisma.leave.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { employee: { select: { nameKo: true } } },
      })
      return successResponse(updated)
    }

    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION', 400)
  } catch (error) {
    return handleApiError(error)
  }
}

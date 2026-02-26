import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLeaveSchema } from '@/lib/validations/hr'
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
              employeeNo: true,
              nameKo: true,
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
    const authResult = await requirePermissionCheck('hr', 'create')
    if (isErrorResponse(authResult)) return authResult

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
    const authResult = await requirePermissionCheck('hr', 'update')
    if (isErrorResponse(authResult)) return authResult

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
      const year = new Date(leave.startDate).getFullYear()
      // 잔여일 조회 + 상태 변경 + 잔여일 차감을 하나의 트랜잭션으로 처리
      const updated = await prisma.$transaction(async (tx) => {
        const balance = await tx.leaveBalance.findFirst({
          where: { employeeId: leave.employeeId, year },
        })
        if (!balance) {
          throw new Error('NOT_FOUND:해당 연도의 휴가 잔여일 정보가 없습니다.')
        }
        if (Number(balance.remainingDays) < Number(leave.days)) {
          throw new Error(`INSUFFICIENT:잔여 휴가일수(${balance.remainingDays}일)가 부족합니다.`)
        }
        const result = await tx.leave.update({
          where: { id },
          data: { status: 'APPROVED' },
          include: { employee: { select: { nameKo: true } } },
        })
        await tx.leaveBalance.updateMany({
          where: { employeeId: leave.employeeId, year },
          data: {
            usedDays: { increment: Number(leave.days) },
            remainingDays: { decrement: Number(leave.days) },
          },
        })
        return result
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
      const wasApproved = leave.status === 'APPROVED'
      const year = new Date(leave.startDate).getFullYear()
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.leave.update({
          where: { id },
          data: { status: 'CANCELLED' },
          include: { employee: { select: { nameKo: true } } },
        })
        if (wasApproved) {
          await tx.leaveBalance.updateMany({
            where: { employeeId: leave.employeeId, year },
            data: {
              usedDays: { decrement: Number(leave.days) },
              remainingDays: { increment: Number(leave.days) },
            },
          })
        }
        return result
      })
      return successResponse(updated)
    }

    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION', 400)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('NOT_FOUND:')) {
        return errorResponse(error.message.slice(10), 'NOT_FOUND', 404)
      }
      if (error.message.startsWith('INSUFFICIENT:')) {
        return errorResponse(error.message.slice(13), 'INSUFFICIENT_BALANCE', 400)
      }
    }
    return handleApiError(error)
  }
}

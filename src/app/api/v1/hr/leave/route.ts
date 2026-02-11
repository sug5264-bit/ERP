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
            select: { employeeNo: true, nameKo: true, department: { select: { name: true } } },
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

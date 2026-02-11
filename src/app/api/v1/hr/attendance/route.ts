import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAttendanceSchema } from '@/lib/validations/hr'
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (startDate && endDate) {
      where.workDate = { gte: new Date(startDate), lte: new Date(endDate) }
    }

    const [records, totalCount] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: { employeeNo: true, nameKo: true, department: { select: { name: true } } },
          },
        },
        orderBy: { workDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.attendance.count({ where }),
    ])

    return successResponse(records, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const validated = createAttendanceSchema.parse(body)

    const checkIn = validated.checkInTime ? new Date(validated.checkInTime) : null
    const checkOut = validated.checkOutTime ? new Date(validated.checkOutTime) : null
    let workHours = null
    let overtimeHours = null

    if (checkIn && checkOut) {
      const diff = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
      workHours = Math.max(0, diff - 1) // 점심 1시간 제외
      overtimeHours = Math.max(0, workHours - 8)
    }

    const attendance = await prisma.attendance.create({
      data: {
        employeeId: validated.employeeId,
        workDate: new Date(validated.workDate),
        checkInTime: checkIn,
        checkOutTime: checkOut,
        workHours,
        overtimeHours,
        attendanceType: validated.attendanceType,
        note: validated.note,
      },
    })

    return successResponse(attendance)
  } catch (error) {
    return handleApiError(error)
  }
}

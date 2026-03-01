import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAttendanceSchema } from '@/lib/validations/hr'
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (startDate || endDate) {
      const dateRange: { gte?: Date; lte?: Date } = {}
      if (startDate) {
        const sd = new Date(startDate)
        if (!isNaN(sd.getTime())) dateRange.gte = sd
      }
      if (endDate) {
        const ed = new Date(endDate)
        if (!isNaN(ed.getTime())) dateRange.lte = ed
      }
      where.workDate = dateRange
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
    const authResult = await requirePermissionCheck('hr', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const validated = createAttendanceSchema.parse(body)

    // 동일 사원, 동일 근무일 중복 체크
    const workDate = new Date(validated.workDate)
    if (isNaN(workDate.getTime())) {
      return errorResponse('올바른 근무일 형식이 아닙니다.', 'BAD_REQUEST', 400)
    }
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId: validated.employeeId,
        workDate,
      },
    })
    if (existing) {
      return errorResponse('해당 날짜에 이미 근태 기록이 있습니다.', 'DUPLICATE_ATTENDANCE', 409)
    }

    const checkIn = validated.checkInTime ? new Date(validated.checkInTime) : null
    const checkOut = validated.checkOutTime ? new Date(validated.checkOutTime) : null
    let workHours = null
    let overtimeHours = null

    if (checkIn && checkOut) {
      if (checkOut.getTime() <= checkIn.getTime()) {
        return errorResponse('퇴근 시간은 출근 시간 이후여야 합니다.', 'BAD_REQUEST', 400)
      }
      const diff = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
      // 6시간 이상 근무 시에만 점심 1시간 차감 (근로기준법 기준)
      const lunchDeduction = diff >= 6 ? 1 : 0
      workHours = Math.max(0, diff - lunchDeduction)
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

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

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (startDate || endDate) {
      where.workDate = {}
      if (startDate) {
        const sd = new Date(startDate)
        if (!isNaN(sd.getTime())) where.workDate.gte = sd
      }
      if (endDate) {
        const ed = new Date(endDate)
        if (!isNaN(ed.getTime())) where.workDate.lte = ed
      }
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

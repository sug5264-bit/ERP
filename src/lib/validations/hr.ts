import { z } from 'zod'

export const createEmployeeSchema = z.object({
  employeeNo: z.string().min(1, '사번을 입력하세요'),
  nameKo: z.string().min(1, '이름을 입력하세요'),
  nameEn: z.string().optional(),
  departmentId: z.string().min(1, '부서를 선택하세요'),
  positionId: z.string().min(1, '직급을 선택하세요'),
  joinDate: z.string().min(1, '입사일을 입력하세요'),
  employeeType: z.enum(['REGULAR', 'CONTRACT', 'DISPATCH', 'INTERN']),
  email: z.string().email('유효한 이메일을 입력하세요').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED']).optional(),
  resignDate: z.string().nullable().optional(),
})

export const createDepartmentSchema = z.object({
  code: z.string().min(1, '부서코드를 입력하세요'),
  name: z.string().min(1, '부서명을 입력하세요'),
  parentId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
})

export const createPositionSchema = z.object({
  code: z.string().min(1, '직급코드를 입력하세요'),
  name: z.string().min(1, '직급명을 입력하세요'),
  level: z.number().min(1),
  sortOrder: z.number().optional(),
})

export const createAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  workDate: z.string().min(1),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  attendanceType: z.enum(['NORMAL', 'LATE', 'EARLY', 'ABSENT', 'BUSINESS', 'REMOTE']),
  note: z.string().optional(),
})

export const createLeaveSchema = z.object({
  employeeId: z.string().min(1),
  leaveType: z.enum(['ANNUAL', 'SICK', 'FAMILY', 'MATERNITY', 'PARENTAL', 'OFFICIAL']),
  startDate: z.string().min(1, '시작일을 입력하세요'),
  endDate: z.string().min(1, '종료일을 입력하세요'),
  days: z.number().min(0.5),
  reason: z.string().optional(),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type CreatePositionInput = z.infer<typeof createPositionSchema>
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>

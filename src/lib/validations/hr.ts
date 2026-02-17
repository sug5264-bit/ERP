import { z } from 'zod'

export const createEmployeeSchema = z.object({
  employeeNo: z.string().min(1, '사번을 입력하세요').max(20, '사번은 20자 이내여야 합니다').regex(/^[A-Za-z0-9-]+$/, '사번은 영문, 숫자, 하이픈만 사용 가능합니다'),
  nameKo: z.string().min(1, '이름을 입력하세요').max(50, '이름은 50자 이내여야 합니다'),
  nameEn: z.string().max(100).optional(),
  departmentId: z.string().min(1, '부서를 선택하세요').max(50),
  positionId: z.string().min(1, '직급을 선택하세요').max(50),
  joinDate: z.string().min(1, '입사일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  employeeType: z.enum(['REGULAR', 'CONTRACT', 'DISPATCH', 'INTERN']),
  email: z.string().email('유효한 이메일을 입력하세요').max(200).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  bankName: z.string().max(50).optional(),
  bankAccount: z.string().max(50).optional(),
  gender: z.string().max(10).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().or(z.literal('')),
})

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED']).optional(),
  resignDate: z.string().nullable().optional(),
})

export const createDepartmentSchema = z.object({
  code: z.string().min(1, '부서코드를 입력하세요').max(20).regex(/^[A-Za-z0-9-]+$/, '코드는 영문, 숫자, 하이픈만 사용 가능합니다'),
  name: z.string().min(1, '부서명을 입력하세요').max(100),
  parentId: z.string().max(50).nullable().optional(),
  managerId: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const createPositionSchema = z.object({
  code: z.string().min(1, '직급코드를 입력하세요').max(20).regex(/^[A-Za-z0-9-]+$/, '코드는 영문, 숫자, 하이픈만 사용 가능합니다'),
  name: z.string().min(1, '직급명을 입력하세요').max(100),
  level: z.number().int().min(1).max(99),
  sortOrder: z.number().int().min(0).max(9999).optional(),
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

import { z } from 'zod'

export const createProjectSchema = z.object({
  projectCode: z
    .string()
    .min(1, '프로젝트 코드를 입력하세요')
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, '코드는 영문, 숫자, 하이픈만 사용 가능합니다'),
  projectName: z.string().min(1, '프로젝트명을 입력하세요').max(200),
  managerId: z.string().min(1, '관리자를 선택하세요').max(50),
  departmentId: z.string().min(1, '부서를 선택하세요').max(50),
  startDate: z
    .string()
    .min(1, '시작일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  budget: z.number().min(0).max(999_999_999_999).optional(),
  description: z.string().max(2000).optional(),
})

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  progress: z.number().min(0).max(100).optional(),
})

export const createProjectTaskSchema = z.object({
  projectId: z.string().min(1).max(50),
  taskName: z.string().min(1, '작업명을 입력하세요').max(200),
  assigneeId: z.string().max(50).optional(),
  parentTaskId: z.string().max(50).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
  description: z.string().max(2000).optional(),
  estimatedHours: z.number().min(0).max(9999).optional(),
})

export const updateProjectTaskSchema = z.object({
  status: z.enum(['WAITING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']).optional(),
  progress: z.number().min(0).max(100).optional(),
  actualHours: z.number().min(0).max(9999).optional(),
  assigneeId: z.string().max(50).optional(),
})

export const addProjectMemberSchema = z.object({
  projectId: z.string().min(1).max(50),
  employeeId: z.string().min(1, '사원을 선택하세요').max(50),
  role: z.enum(['PM', 'MEMBER', 'REVIEWER']).optional(),
})

export const createPayrollSchema = z.object({
  payPeriod: z.string().min(1, '급여기간을 입력하세요').max(20),
  payDate: z
    .string()
    .min(1, '지급일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
})

import { z } from 'zod'

export const createProjectSchema = z.object({
  projectCode: z.string().min(1, '프로젝트 코드를 입력하세요'),
  projectName: z.string().min(1, '프로젝트명을 입력하세요'),
  managerId: z.string().min(1, '관리자를 선택하세요'),
  departmentId: z.string().min(1, '부서를 선택하세요'),
  startDate: z.string().min(1, '시작일을 입력하세요'),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  description: z.string().optional(),
})

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  progress: z.number().min(0).max(100).optional(),
})

export const createProjectTaskSchema = z.object({
  projectId: z.string().min(1),
  taskName: z.string().min(1, '작업명을 입력하세요'),
  assigneeId: z.string().optional(),
  parentTaskId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
  description: z.string().optional(),
  estimatedHours: z.number().optional(),
})

export const updateProjectTaskSchema = z.object({
  status: z.enum(['WAITING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']).optional(),
  progress: z.number().min(0).max(100).optional(),
  actualHours: z.number().optional(),
  assigneeId: z.string().optional(),
})

export const addProjectMemberSchema = z.object({
  projectId: z.string().min(1),
  employeeId: z.string().min(1, '사원을 선택하세요'),
  role: z.enum(['PM', 'MEMBER', 'REVIEWER']).optional(),
})

export const createPayrollSchema = z.object({
  payPeriod: z.string().min(1, '급여기간을 입력하세요'),
  payDate: z.string().min(1, '지급일을 입력하세요'),
})

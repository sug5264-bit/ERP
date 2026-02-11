import { z } from 'zod'

export const createUserSchema = z.object({
  username: z.string().min(2, '아이디는 2자 이상이어야 합니다').regex(/^[a-zA-Z0-9._]+$/, '아이디는 영문, 숫자, 점, 밑줄만 사용 가능합니다'),
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
  name: z.string().min(1, '이름을 입력하세요'),
  employeeId: z.string().optional(),
  roleIds: z.array(z.string()).min(1, '역할을 하나 이상 선택하세요'),
})

export const updateUserSchema = z.object({
  username: z.string().min(2, '아이디는 2자 이상이어야 합니다').regex(/^[a-zA-Z0-9._]+$/, '아이디는 영문, 숫자, 점, 밑줄만 사용 가능합니다').optional(),
  email: z.string().email('유효한 이메일을 입력하세요').optional(),
  name: z.string().min(1, '이름을 입력하세요').optional(),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다').optional(),
  isActive: z.boolean().optional(),
  employeeId: z.string().nullable().optional(),
  roleIds: z.array(z.string()).optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

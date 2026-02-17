import { z } from 'zod'

export const createUserSchema = z.object({
  username: z.string().min(2, '아이디는 2자 이상이어야 합니다').max(50, '아이디는 50자 이내여야 합니다').regex(/^[a-zA-Z0-9._]+$/, '아이디는 영문, 숫자, 점, 밑줄만 사용 가능합니다'),
  email: z.string().email('유효한 이메일을 입력하세요').max(200),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(100),
  name: z.string().min(1, '이름을 입력하세요').max(100),
  employeeId: z.string().max(50).optional(),
  roleIds: z.array(z.string().max(50)).min(1, '역할을 하나 이상 선택하세요').max(10),
})

export const updateUserSchema = z.object({
  username: z.string().min(2, '아이디는 2자 이상이어야 합니다').max(50).regex(/^[a-zA-Z0-9._]+$/, '아이디는 영문, 숫자, 점, 밑줄만 사용 가능합니다').optional(),
  email: z.string().email('유효한 이메일을 입력하세요').max(200).optional(),
  name: z.string().min(1, '이름을 입력하세요').max(100).optional(),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(100).optional(),
  isActive: z.boolean().optional(),
  employeeId: z.string().max(50).nullable().optional(),
  roleIds: z.array(z.string().max(50)).max(10).optional(),
  departmentId: z.string().max(50).optional(),
  positionId: z.string().max(50).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

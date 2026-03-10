import { describe, it, expect } from 'vitest'
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  createDepartmentSchema,
  createPositionSchema,
  createLeaveSchema,
  createAttendanceSchema,
  createPayrollSchema,
} from '@/lib/validations/hr'

describe('createEmployeeSchema', () => {
  const validEmployee = {
    employeeNo: 'EMP-001',
    nameKo: '홍길동',
    departmentId: 'dept-1',
    positionId: 'pos-1',
    joinDate: '2024-01-15',
    employeeType: 'REGULAR' as const,
  }

  it('유효한 사원 데이터 통과', () => {
    const result = createEmployeeSchema.safeParse(validEmployee)
    expect(result.success).toBe(true)
  })

  it('사번 필수', () => {
    const result = createEmployeeSchema.safeParse({ ...validEmployee, employeeNo: '' })
    expect(result.success).toBe(false)
  })

  it('사번 영문/숫자/하이픈만 허용', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, employeeNo: 'EMP-001' }).success).toBe(true)
    expect(createEmployeeSchema.safeParse({ ...validEmployee, employeeNo: 'emp001' }).success).toBe(true)
    expect(createEmployeeSchema.safeParse({ ...validEmployee, employeeNo: '사번-001' }).success).toBe(false)
    expect(createEmployeeSchema.safeParse({ ...validEmployee, employeeNo: 'EMP 001' }).success).toBe(false)
  })

  it('이름 필수 및 길이 제한', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, nameKo: '' }).success).toBe(false)
    expect(createEmployeeSchema.safeParse({ ...validEmployee, nameKo: 'a'.repeat(51) }).success).toBe(false)
  })

  it('입사일 형식 검증', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, joinDate: '2024-01-15' }).success).toBe(true)
    expect(createEmployeeSchema.safeParse({ ...validEmployee, joinDate: '2024/01/15' }).success).toBe(false)
    expect(createEmployeeSchema.safeParse({ ...validEmployee, joinDate: '' }).success).toBe(false)
  })

  it('고용유형 enum 검증', () => {
    for (const type of ['REGULAR', 'CONTRACT', 'DISPATCH', 'INTERN']) {
      expect(createEmployeeSchema.safeParse({ ...validEmployee, employeeType: type }).success).toBe(true)
    }
    expect(createEmployeeSchema.safeParse({ ...validEmployee, employeeType: 'INVALID' }).success).toBe(false)
  })

  it('이메일 검증 (선택적)', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, email: 'test@example.com' }).success).toBe(true)
    expect(createEmployeeSchema.safeParse({ ...validEmployee, email: '' }).success).toBe(true)
    expect(createEmployeeSchema.safeParse({ ...validEmployee, email: 'not-email' }).success).toBe(false)
  })

  it('선택적 필드 누락 가능', () => {
    const result = createEmployeeSchema.safeParse(validEmployee)
    expect(result.success).toBe(true)
  })

  it('모든 선택적 필드 포함', () => {
    const result = createEmployeeSchema.safeParse({
      ...validEmployee,
      nameEn: 'Hong Gildong',
      email: 'hong@company.com',
      phone: '010-1234-5678',
      address: '서울시 강남구',
      bankName: '국민은행',
      bankAccount: '123-456-789',
      gender: '남성',
      birthDate: '1990-01-01',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateEmployeeSchema', () => {
  it('부분 업데이트 허용', () => {
    const result = updateEmployeeSchema.safeParse({ nameKo: '김수정' })
    expect(result.success).toBe(true)
  })

  it('상태 변경 가능', () => {
    const result = updateEmployeeSchema.safeParse({ status: 'RESIGNED' })
    expect(result.success).toBe(true)
  })

  it('퇴사일 nullable', () => {
    expect(updateEmployeeSchema.safeParse({ resignDate: '2024-12-31' }).success).toBe(true)
    expect(updateEmployeeSchema.safeParse({ resignDate: null }).success).toBe(true)
  })
})

describe('createDepartmentSchema', () => {
  it('유효한 부서 데이터 통과', () => {
    const result = createDepartmentSchema.safeParse({
      code: 'DEV-01',
      name: '개발팀',
    })
    expect(result.success).toBe(true)
  })

  it('부서코드 영문/숫자/하이픈만', () => {
    expect(createDepartmentSchema.safeParse({ code: 'DEV-01', name: '개발팀' }).success).toBe(true)
    expect(createDepartmentSchema.safeParse({ code: '개발팀', name: '개발팀' }).success).toBe(false)
    expect(createDepartmentSchema.safeParse({ code: '', name: '개발팀' }).success).toBe(false)
  })

  it('parentId 선택적', () => {
    expect(createDepartmentSchema.safeParse({ code: 'HR', name: 'HR팀', parentId: null }).success).toBe(true)
    expect(createDepartmentSchema.safeParse({ code: 'HR', name: 'HR팀', parentId: 'parent-1' }).success).toBe(true)
  })
})

describe('createPositionSchema', () => {
  it('유효한 직급 데이터 통과', () => {
    const result = createPositionSchema.safeParse({
      code: 'P01',
      name: '사원',
      level: 1,
    })
    expect(result.success).toBe(true)
  })

  it('레벨 1~99 범위', () => {
    expect(createPositionSchema.safeParse({ code: 'P', name: '직급', level: 0 }).success).toBe(false)
    expect(createPositionSchema.safeParse({ code: 'P', name: '직급', level: 1 }).success).toBe(true)
    expect(createPositionSchema.safeParse({ code: 'P', name: '직급', level: 99 }).success).toBe(true)
    expect(createPositionSchema.safeParse({ code: 'P', name: '직급', level: 100 }).success).toBe(false)
  })
})

describe('createLeaveSchema', () => {
  const validLeave = {
    employeeId: 'emp-1',
    leaveType: 'ANNUAL' as const,
    startDate: '2024-06-10',
    endDate: '2024-06-12',
    days: 3,
  }

  it('유효한 휴가 데이터 통과', () => {
    const result = createLeaveSchema.safeParse(validLeave)
    expect(result.success).toBe(true)
  })

  it('휴가 유형 enum 검증', () => {
    for (const type of ['ANNUAL', 'SICK', 'FAMILY', 'MATERNITY', 'PARENTAL', 'OFFICIAL']) {
      expect(createLeaveSchema.safeParse({ ...validLeave, leaveType: type }).success).toBe(true)
    }
    expect(createLeaveSchema.safeParse({ ...validLeave, leaveType: 'INVALID' }).success).toBe(false)
  })

  it('최소 0.5일 이상', () => {
    expect(createLeaveSchema.safeParse({ ...validLeave, days: 0.5 }).success).toBe(true)
    expect(createLeaveSchema.safeParse({ ...validLeave, days: 0.3 }).success).toBe(false)
    expect(createLeaveSchema.safeParse({ ...validLeave, days: 0 }).success).toBe(false)
  })

  it('최대 365일', () => {
    expect(createLeaveSchema.safeParse({ ...validLeave, days: 365 }).success).toBe(true)
    expect(createLeaveSchema.safeParse({ ...validLeave, days: 366 }).success).toBe(false)
  })

  it('반차(0.5일) 허용', () => {
    const result = createLeaveSchema.safeParse({
      ...validLeave,
      startDate: '2024-06-10',
      endDate: '2024-06-10',
      days: 0.5,
    })
    expect(result.success).toBe(true)
  })

  it('종료일이 시작일 이전이면 거부', () => {
    const result = createLeaveSchema.safeParse({
      ...validLeave,
      startDate: '2024-06-15',
      endDate: '2024-06-10',
      days: 3,
    })
    expect(result.success).toBe(false)
  })

  it('같은 날짜는 허용', () => {
    const result = createLeaveSchema.safeParse({
      ...validLeave,
      startDate: '2024-06-10',
      endDate: '2024-06-10',
      days: 1,
    })
    expect(result.success).toBe(true)
  })
})

describe('createAttendanceSchema', () => {
  it('유효한 근태 데이터 통과', () => {
    const result = createAttendanceSchema.safeParse({
      employeeId: 'emp-1',
      workDate: '2024-06-10',
      attendanceType: 'NORMAL',
    })
    expect(result.success).toBe(true)
  })

  it('근태유형 enum 검증', () => {
    for (const type of ['NORMAL', 'LATE', 'EARLY', 'ABSENT', 'BUSINESS', 'REMOTE']) {
      expect(
        createAttendanceSchema.safeParse({
          employeeId: 'emp-1',
          workDate: '2024-06-10',
          attendanceType: type,
        }).success
      ).toBe(true)
    }
  })
})

describe('createPayrollSchema', () => {
  it('유효한 급여 데이터 통과', () => {
    const result = createPayrollSchema.safeParse({
      payPeriod: '2024-06',
      payDate: '2024-06-25',
    })
    expect(result.success).toBe(true)
  })

  it('급여기간 필수', () => {
    expect(createPayrollSchema.safeParse({ payPeriod: '', payDate: '2024-06-25' }).success).toBe(false)
  })

  it('지급일 날짜 형식', () => {
    expect(createPayrollSchema.safeParse({ payPeriod: '2024-06', payDate: 'invalid' }).success).toBe(false)
  })
})

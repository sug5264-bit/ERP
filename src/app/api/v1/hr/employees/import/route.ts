import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'create')
    if (isErrorResponse(authResult)) return authResult

    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse('업로드할 데이터가 없습니다.', 'EMPTY_DATA')
    }
    if (rows.length > 500) {
      return errorResponse('한 번에 최대 500건까지 업로드할 수 있습니다.', 'TOO_LARGE', 413)
    }

    // Preload departments and positions for name-based matching (trim + case-insensitive)
    const departments = await prisma.department.findMany()
    const positions = await prisma.position.findMany()
    const deptMap = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]))
    const posMap = new Map(positions.map((p) => [p.name.trim().toLowerCase(), p.id]))

    let success = 0
    let failed = 0
    const errors: { row: number; message: string }[] = []

    const typeMap: Record<string, string> = {
      정규직: 'REGULAR',
      계약직: 'CONTRACT',
      파견직: 'DISPATCH',
      인턴: 'INTERN',
    }

    const EMPLOYEE_NO_RE = /^[A-Za-z0-9-]{1,20}$/
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const PHONE_RE = /^[\d\s()+-]{0,20}$/
    const VALID_TYPES = new Set(['REGULAR', 'CONTRACT', 'DISPATCH', 'INTERN'])

    // 기존 사번 일괄 조회 (N+1 쿼리 방지)
    const allEmpNos = rows
      .map((r: any) => (r.employeeNo ? String(r.employeeNo).trim() : ''))
      .filter((n: string) => n.length > 0)
    const existingEmployees = await prisma.employee.findMany({
      where: { employeeNo: { in: allEmpNos } },
      select: { employeeNo: true },
    })
    const existingEmpNoSet = new Set(existingEmployees.map((e) => e.employeeNo))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      try {
        // 필수 필드 검증
        if (!row.employeeNo || !row.nameKo) {
          throw new Error('사번과 이름은 필수입니다.')
        }

        // 사번 형식 검증
        const empNo = String(row.employeeNo).trim()
        if (!EMPLOYEE_NO_RE.test(empNo)) {
          throw new Error('사번은 영문, 숫자, 하이픈만 사용 가능합니다 (최대 20자).')
        }

        // 이름 길이 검증
        const nameKo = String(row.nameKo).trim()
        if (nameKo.length > 50) {
          throw new Error('이름은 50자 이내여야 합니다.')
        }

        // 이메일 형식 검증
        if (row.email && !EMAIL_RE.test(String(row.email))) {
          throw new Error('유효한 이메일 형식이 아닙니다.')
        }

        // 전화번호 형식 검증
        if (row.phone && !PHONE_RE.test(String(row.phone))) {
          throw new Error('유효한 전화번호 형식이 아닙니다.')
        }

        // 고용유형 검증
        const mappedType = typeMap[row.employeeType] || row.employeeType || 'REGULAR'
        if (!VALID_TYPES.has(mappedType)) {
          throw new Error(`유효하지 않은 고용유형입니다: ${row.employeeType}`)
        }

        // 날짜 검증
        if (row.joinDate && isNaN(new Date(row.joinDate).getTime())) {
          throw new Error('유효하지 않은 입사일입니다.')
        }
        if (row.birthDate && isNaN(new Date(row.birthDate).getTime())) {
          throw new Error('유효하지 않은 생년월일입니다.')
        }

        if (existingEmpNoSet.has(empNo)) {
          throw new Error(`사번 '${empNo}'가 이미 존재합니다.`)
        }

        const deptKey = row.department ? String(row.department).trim().toLowerCase() : ''
        const posKey = row.position ? String(row.position).trim().toLowerCase() : ''
        const departmentId = row.departmentId || deptMap.get(deptKey)
        const positionId = row.positionId || posMap.get(posKey)

        if (!departmentId) throw new Error(`부서 "${row.department || ''}" 를 찾을 수 없습니다.`)
        if (!positionId) throw new Error(`직급 "${row.position || ''}" 를 찾을 수 없습니다.`)

        await prisma.employee.create({
          data: {
            employeeNo: empNo,
            nameKo,
            nameEn: row.nameEn ? String(row.nameEn).trim().slice(0, 100) : undefined,
            departmentId,
            positionId,
            joinDate: row.joinDate ? new Date(row.joinDate) : new Date(),
            employeeType: mappedType,
            phone: row.phone ? String(row.phone).trim() : undefined,
            email: row.email ? String(row.email).trim() : undefined,
            gender: row.gender || undefined,
            birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
          },
        })
        success++
      } catch (err: unknown) {
        failed++
        errors.push({ row: rowNum, message: err instanceof Error ? err.message : '알 수 없는 오류' })
      }
    }

    return successResponse({ success, failed, errors })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return errorResponse('업로드할 데이터가 없습니다.', 'EMPTY_DATA')
    }
    if (rows.length > 500) {
      return errorResponse('한 번에 최대 500건까지 업로드할 수 있습니다.', 'TOO_LARGE', 413)
    }

    // Preload departments and positions for name-based matching
    const departments = await prisma.department.findMany()
    const positions = await prisma.position.findMany()
    const deptMap = new Map(departments.map((d) => [d.name, d.id]))
    const posMap = new Map(positions.map((p) => [p.name, p.id]))

    let success = 0
    let failed = 0
    const errors: { row: number; message: string }[] = []

    const typeMap: Record<string, string> = {
      '정규직': 'REGULAR', '계약직': 'CONTRACT', '파견직': 'DISPATCH', '인턴': 'INTERN',
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      try {
        if (!row.employeeNo || !row.nameKo) {
          throw new Error('사번과 이름은 필수입니다.')
        }

        const existing = await prisma.employee.findUnique({ where: { employeeNo: row.employeeNo } })
        if (existing) {
          throw new Error(`사번 '${row.employeeNo}'가 이미 존재합니다.`)
        }

        const departmentId = row.departmentId || deptMap.get(row.department)
        const positionId = row.positionId || posMap.get(row.position)

        if (!departmentId) throw new Error('부서를 찾을 수 없습니다.')
        if (!positionId) throw new Error('직급을 찾을 수 없습니다.')

        await prisma.employee.create({
          data: {
            employeeNo: String(row.employeeNo),
            nameKo: String(row.nameKo),
            nameEn: row.nameEn ? String(row.nameEn) : undefined,
            departmentId,
            positionId,
            joinDate: row.joinDate ? new Date(row.joinDate) : new Date(),
            employeeType: typeMap[row.employeeType] || row.employeeType || 'REGULAR',
            phone: row.phone ? String(row.phone) : undefined,
            email: row.email ? String(row.email) : undefined,
            gender: row.gender || undefined,
            birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
          },
        })
        success++
      } catch (err: any) {
        failed++
        errors.push({ row: rowNum, message: err.message || '알 수 없는 오류' })
      }
    }

    return successResponse({ success, failed, errors })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/health/seed
 * 시드 데이터 상태 확인 (개발 환경 전용)
 * - 민감 정보(비밀번호, 해시) 노출 없음
 * - 자동 비밀번호 복구 기능 제거 (보안 위험)
 */
export async function GET() {
  const checks: Record<string, unknown> = {}

  try {
    // 1. 환경변수 설정 여부 확인 (값 노출 없음)
    checks.authSecretSet = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)

    // 2. admin 사용자 존재 및 활성 상태 확인 (비밀번호 정보 노출 없음)
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        isActive: true,
        userRoles: { include: { role: { select: { name: true } } } },
      },
    })

    if (!admin) {
      checks.adminExists = false
      checks.message = 'admin 사용자가 존재하지 않습니다. 시드 데이터를 실행해주세요.'
      return NextResponse.json(checks, { status: 404 })
    }

    checks.adminExists = true
    checks.adminActive = admin.isActive
    checks.roles = admin.userRoles.map((r) => r.role.name)

    // 3. 기본 사용자 존재 여부 확인 (비밀번호 검증/복구 없음)
    const seedUsernames = ['parksales', 'leedev', 'hanacct', 'kangstaff']
    const existingUsers = await prisma.user.findMany({
      where: { username: { in: seedUsernames } },
      select: { username: true, isActive: true },
    })
    checks.seedUsers = {
      expected: seedUsernames.length,
      found: existingUsers.length,
      active: existingUsers.filter((u) => u.isActive).length,
    }

    // 4. 진단 요약
    if (!checks.authSecretSet) {
      checks.warning = 'AUTH_SECRET이 설정되지 않았습니다! 로그인이 작동하지 않을 수 있습니다.'
    }

    checks.message = 'admin 계정이 정상적으로 존재합니다.'

    return NextResponse.json(checks)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/debug
 * 인증 시스템 기본 진단 (DB 연결, 사용자 존재 여부)
 * - 비밀번호, 해시, 자격증명 등 민감 정보는 절대 노출하지 않음
 * - 프로덕션 환경에서는 관리자 인증 필요
 */
export async function GET() {
  // 모든 환경에서 관리자 인증 필요
  try {
    const { auth } = await import('@/lib/auth')
    const session = await auth()
    const user = session?.user as Record<string, unknown> | undefined
    const roles = (user?.roles as string[]) || []
    if (!session || (!roles.includes('SYSTEM_ADMIN') && !roles.includes('관리자'))) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다.' }, { status: 500 })
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }

  // 1. 환경변수 체크 (값은 절대 노출하지 않고 설정 여부만 확인)
  results.env = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    AUTH_SECRET_SUFFICIENT: (process.env.AUTH_SECRET?.length ?? 0) >= 32,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_URL: !!process.env.AUTH_URL,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    DATABASE_URL: !!process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  }

  // 2. DB 연결 테스트
  try {
    await prisma.$queryRawUnsafe('SELECT 1 as ok')
    results.dbConnection = { ok: true }
  } catch (error) {
    results.dbConnection = { ok: false, error: (error as Error).message }
  }

  // 3. admin 사용자 존재 여부만 확인 (비밀번호 정보 노출 없음)
  try {
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        isActive: true,
        userRoles: {
          include: {
            role: { select: { name: true } },
          },
        },
      },
    })

    if (!admin) {
      results.adminUser = { exists: false, message: 'admin 사용자가 존재하지 않습니다' }
    } else {
      results.adminUser = {
        exists: true,
        isActive: admin.isActive,
        roles: admin.userRoles.map((ur) => ur.role.name),
        rolesCount: admin.userRoles.length,
      }
    }
  } catch (error) {
    results.adminUser = { error: (error as Error).message }
  }

  // 4. 전체 사용자 수 (민감 정보 없이 카운트만)
  try {
    const userCount = await prisma.user.count()
    const activeCount = await prisma.user.count({ where: { isActive: true } })
    results.users = { total: userCount, active: activeCount }
  } catch (error) {
    results.users = { error: (error as Error).message }
  }

  // 5. NextAuth 세션 테스트
  try {
    const { auth } = await import('@/lib/auth')
    const session = await auth()
    results.currentSession = session ? { hasSession: true } : { hasSession: false }
  } catch (error) {
    results.nextAuth = { ok: false, error: (error as Error).message }
  }

  // 6. 최종 판단
  const issues: string[] = []
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    issues.push('AUTH_SECRET 환경변수가 설정되지 않았습니다.')
  }
  if ((process.env.AUTH_SECRET?.length ?? 0) < 32) {
    issues.push('AUTH_SECRET가 너무 짧습니다. 최소 32자 이상 권장합니다.')
  }
  if (!process.env.DATABASE_URL) {
    issues.push('DATABASE_URL이 설정되지 않았습니다.')
  }
  const adminResult = results.adminUser as Record<string, unknown> | undefined
  if (adminResult && !adminResult.exists) {
    issues.push('admin 사용자가 DB에 존재하지 않습니다. 시드 데이터를 실행하세요.')
  }

  results.diagnosis = {
    issues,
    status: issues.length === 0 ? 'OK' : 'ISSUES_FOUND',
  }

  return NextResponse.json(results, { status: issues.length > 0 ? 500 : 200 })
}

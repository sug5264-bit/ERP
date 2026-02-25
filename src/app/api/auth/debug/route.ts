import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compare, hash } from 'bcryptjs'

/**
 * GET /api/auth/debug
 * 인증 시스템 전체 진단 - DB, 비밀번호, 환경변수, JWT 설정 확인
 * ⚠️ 개발 환경에서만 사용 가능
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    )
  }
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }

  // 1. 환경변수 체크
  results.env = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    AUTH_SECRET_LENGTH: process.env.AUTH_SECRET?.length ?? 0,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL ?? 'NOT SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'NOT SET',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  }

  // 2. DB 연결 테스트
  try {
    const dbResult = await prisma.$queryRawUnsafe('SELECT 1 as ok')
    results.dbConnection = { ok: true, result: dbResult }
  } catch (error) {
    results.dbConnection = { ok: false, error: (error as Error).message }
  }

  // 3. admin 사용자 확인
  try {
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        passwordHash: true,
        employeeId: true,
        userRoles: {
          include: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    })

    if (!admin) {
      results.adminUser = { exists: false, message: 'admin 사용자가 존재하지 않습니다' }
    } else {
      // 4. 비밀번호 검증
      const isValid = await compare('admin1234', admin.passwordHash)
      const hashPrefix = admin.passwordHash.substring(0, 20) + '...'

      results.adminUser = {
        exists: true,
        isActive: admin.isActive,
        hasEmployeeId: !!admin.employeeId,
        roles: admin.userRoles.map((ur) => ur.role.name),
        rolesCount: admin.userRoles.length,
        passwordHashPrefix: hashPrefix,
        passwordValid: isValid,
      }

      // 5. 비밀번호가 틀리면 자동 복구
      if (!isValid) {
        const newHash = await hash('admin1234', 10)
        await prisma.user.update({
          where: { username: 'admin' },
          data: { passwordHash: newHash },
        })

        // 검증
        const verified = await compare('admin1234', newHash)
        results.passwordReset = {
          done: true,
          verified,
          message: 'admin 비밀번호가 복구되었습니다',
        }
      }
    }
  } catch (error) {
    results.adminUser = { error: (error as Error).message }
  }

  // 6. bcryptjs 동작 테스트
  try {
    const testHash = await hash('test123', 10)
    const testCompare = await compare('test123', testHash)
    results.bcryptjs = {
      ok: testCompare,
      hashGenerated: testHash.substring(0, 20) + '...',
    }
  } catch (error) {
    results.bcryptjs = { ok: false, error: (error as Error).message }
  }

  // 7. 전체 사용자 목록 (비밀번호 검증 포함)
  try {
    const users = await prisma.user.findMany({
      select: {
        username: true,
        isActive: true,
        passwordHash: true,
        userRoles: { include: { role: { select: { name: true } } } },
      },
    })

    const userChecks = await Promise.all(
      users.map(async (u) => {
        const expectedPw = u.username === 'admin' ? 'admin1234' : 'user1234'
        const valid = await compare(expectedPw, u.passwordHash)
        return {
          username: u.username,
          isActive: u.isActive,
          roles: u.userRoles.map((ur) => ur.role.name),
          passwordValid: valid,
        }
      })
    )
    results.allUsers = userChecks
  } catch (error) {
    results.allUsers = { error: (error as Error).message }
  }

  // 8. NextAuth 내부 설정 확인
  try {
    const { auth } = await import('@/lib/auth')
    results.nextAuthImport = { ok: true }

    // 세션 테스트 (현재 요청에서)
    const session = await auth()
    results.currentSession = session ? { hasSession: true, userId: session.user?.id } : { hasSession: false }
  } catch (error) {
    results.nextAuthImport = { ok: false, error: (error as Error).message }
  }

  // 9. 최종 판단
  const issues: string[] = []

  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    issues.push('AUTH_SECRET 환경변수가 설정되지 않았습니다. JWT 토큰 생성이 불가능합니다.')
  }
  if ((process.env.AUTH_SECRET?.length ?? 0) < 16) {
    issues.push('AUTH_SECRET가 너무 짧습니다. 최소 32자 이상 권장합니다.')
  }
  if (!process.env.DATABASE_URL) {
    issues.push('DATABASE_URL이 설정되지 않았습니다.')
  }
  const adminResult = results.adminUser as Record<string, unknown> | undefined
  if (adminResult && !adminResult.exists) {
    issues.push('admin 사용자가 DB에 존재하지 않습니다. 시드 데이터를 실행하세요.')
  }
  if (adminResult?.exists && !adminResult.isActive) {
    issues.push('admin 사용자가 비활성 상태입니다.')
  }
  if (adminResult?.exists && adminResult.rolesCount === 0) {
    issues.push('admin 사용자에 역할이 할당되지 않았습니다.')
  }

  results.diagnosis = {
    issues,
    status: issues.length === 0 ? 'OK' : 'ISSUES_FOUND',
    loginCredentials: 'admin / admin1234',
  }

  return NextResponse.json(results, { status: issues.length > 0 ? 500 : 200 })
}

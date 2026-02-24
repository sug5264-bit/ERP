import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash, compare } from 'bcryptjs'

/**
 * GET /api/health/seed
 * 시드 데이터 상태 확인 및 admin 비밀번호 자동 복구
 */
export async function GET() {
  const checks: Record<string, unknown> = {}

  try {
    // 0. 환경변수 확인
    checks.authSecretSet = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)

    // 1. admin 사용자 존재 확인
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        username: true,
        isActive: true,
        passwordHash: true,
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

    // 2. 비밀번호 검증
    const isValid = await compare('admin1234', admin.passwordHash)
    checks.passwordValid = isValid

    // 3. 비밀번호가 틀리면 자동 복구
    if (!isValid) {
      const newHash = await hash('admin1234', 10)
      await prisma.user.update({
        where: { username: 'admin' },
        data: { passwordHash: newHash },
      })
      // 복구 후 재검증
      const verified = await compare('admin1234', newHash)
      checks.passwordReset = true
      checks.passwordVerified = verified
      checks.message = 'admin 비밀번호가 복구되었습니다. admin / admin1234 로 로그인하세요.'
    } else {
      checks.message = 'admin 계정 정상 (admin / admin1234)'
    }

    // 4. 다른 사용자도 비밀번호 복구
    const otherUsers = await prisma.user.findMany({
      where: { username: { in: ['parksales', 'leedev', 'hanacct', 'kangstaff'] } },
      select: { username: true, passwordHash: true },
    })
    const userHash = await hash('user1234', 10)
    let userFixed = 0
    for (const u of otherUsers) {
      const valid = await compare('user1234', u.passwordHash)
      if (!valid) {
        await prisma.user.update({
          where: { username: u.username },
          data: { passwordHash: userHash },
        })
        userFixed++
      }
    }
    if (userFixed > 0) {
      checks.otherUsersFixed = userFixed
    }

    // 5. 진단 요약
    if (!checks.authSecretSet) {
      checks.warning = 'AUTH_SECRET이 설정되지 않았습니다! 로그인이 작동하지 않을 수 있습니다.'
    }

    return NextResponse.json(checks)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

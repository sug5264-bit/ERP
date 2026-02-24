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
    // 1. admin 사용자 존재 확인
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true, username: true, isActive: true, passwordHash: true },
    })

    if (!admin) {
      checks.adminExists = false
      checks.message = 'admin 사용자가 존재하지 않습니다. 시드 데이터를 실행해주세요.'
      return NextResponse.json(checks, { status: 404 })
    }

    checks.adminExists = true
    checks.adminActive = admin.isActive

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
      checks.passwordReset = true
      checks.message = 'admin 비밀번호가 복구되었습니다. admin / admin1234 로 로그인하세요.'
    } else {
      checks.message = 'admin 계정 정상 (admin / admin1234)'
    }

    // 4. 역할 확인
    const roles = await prisma.userRole.findMany({
      where: { userId: admin.id },
      include: { role: { select: { name: true } } },
    })
    checks.roles = roles.map((r) => r.role.name)

    // 5. 다른 사용자도 비밀번호 복구
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

    return NextResponse.json(checks)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash, compare } from 'bcryptjs'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET() {
  // Require admin authentication
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다. 관리자로 로그인해주세요.' },
      { status: 401 }
    )
  }

  const user = session.user as Record<string, unknown>
  const roles: string[] = Array.isArray(user.roles) ? user.roles : []
  if (!roles.includes('관리자') && !roles.includes('SYSTEM_ADMIN')) {
    return NextResponse.json(
      { success: false, error: '관리자 권한이 필요합니다.' },
      { status: 403 }
    )
  }

  const logs: string[] = []
  const PASSWORD = 'admin1234'

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    logs.push('DB 연결 성공')

    const users = await prisma.$queryRawUnsafe<
      { id: string; username: string; passwordHash: string; isActive: boolean; email: string | null }[]
    >(
      'SELECT "id", "username", "passwordHash", "isActive", "email" FROM "users" WHERE "username" = $1 LIMIT 1',
      'admin'
    )

    if (users.length === 0) {
      logs.push('admin 사용자가 존재하지 않습니다. /api/health/init을 사용해주세요.')
      return NextResponse.json({ success: false, logs, error: 'admin 사용자가 존재하지 않습니다.' }, { status: 404 })
    }

    const admin = users[0]
    logs.push(`admin 사용자 존재: id=${admin.id}, isActive=${admin.isActive}`)

    const oldCompare = await compare(PASSWORD, admin.passwordHash)
    logs.push(`기존 해시로 비교: ${oldCompare}`)

    const newHash = await hash(PASSWORD, 12)
    const newCompare = await compare(PASSWORD, newHash)
    logs.push(`새 해시 검증: ${newCompare}`)

    const updateResult = await prisma.$executeRawUnsafe(
      'UPDATE "users" SET "passwordHash" = $1, "isActive" = true WHERE "id" = $2',
      newHash,
      admin.id
    )
    logs.push(`DB 업데이트 완료 (affected rows: ${updateResult})`)

    const verifyUsers = await prisma.$queryRawUnsafe<{ passwordHash: string; isActive: boolean }[]>(
      'SELECT "passwordHash", "isActive" FROM "users" WHERE "id" = $1 LIMIT 1',
      admin.id
    )
    if (verifyUsers.length > 0) {
      const savedHash = verifyUsers[0].passwordHash
      const finalCompare = await compare(PASSWORD, savedHash)
      logs.push(`DB 재검증: ${finalCompare}, isActive: ${verifyUsers[0].isActive}`)
    }

    const roleCheck = await prisma.$queryRawUnsafe<{ roleName: string }[]>(
      'SELECT r."name" as "roleName" FROM "user_roles" ur JOIN "roles" r ON ur."roleId" = r."id" WHERE ur."userId" = $1',
      admin.id
    )
    logs.push(`역할: ${roleCheck.map((r) => r.roleName).join(', ') || '없음'}`)

    logger.info('Admin password reset', { module: 'auth', action: 'reset-admin', userId: admin.id })

    return NextResponse.json({
      success: true,
      action: 'reset',
      message: '관리자 비밀번호가 리셋되었습니다. 기본 비밀번호로 로그인 후 즉시 변경해주세요.',
      logs,
    })
  } catch (error) {
    logs.push(`에러: ${error instanceof Error ? error.message : String(error)}`)
    return NextResponse.json(
      { success: false, logs, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash, compare } from 'bcryptjs'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'

const DEFAULT_PASSWORD = 'admin1234'

export async function GET() {
  return initAdmin()
}

export async function POST() {
  return initAdmin()
}

async function initAdmin() {
  const logs: string[] = []

  try {
    // Check if any users exist - if yes, require admin authentication
    const userCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*)::bigint as count FROM "users"')
    const hasExistingUsers = userCount.length > 0 && Number(userCount[0].count) > 0

    if (hasExistingUsers) {
      // Require admin session for non-initial setup
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
        return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 })
      }
    }

    await prisma.$queryRawUnsafe('SELECT 1')
    logs.push('DB 연결 성공')

    // admin 사용자 조회
    const users = await prisma.$queryRawUnsafe<
      { id: string; username: string; passwordHash: string; isActive: boolean; email: string | null }[]
    >(
      'SELECT "id", "username", "passwordHash", "isActive", "email" FROM "users" WHERE "username" = $1 LIMIT 1',
      'admin'
    )

    if (users.length === 0) {
      logs.push('admin 사용자 없음 - 새로 생성')

      const roles = await prisma.$queryRawUnsafe<{ id: string }[]>(
        'SELECT "id" FROM "roles" WHERE "name" = $1 LIMIT 1',
        '관리자'
      )
      let roleId: string
      if (roles.length > 0) {
        roleId = roles[0].id
      } else {
        const newRole = await prisma.role.create({
          data: { name: '관리자', description: '시스템 관리자', isSystem: true },
        })
        roleId = newRole.id
      }

      const newHash = await hash(DEFAULT_PASSWORD, 12)
      const newUser = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "users" ("id", "username", "email", "passwordHash", "name", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING "id"`,
        'admin',
        'admin@wellgreen.co.kr',
        newHash,
        '관리자'
      )

      if (newUser.length > 0) {
        await prisma.$executeRawUnsafe(
          'INSERT INTO "user_roles" ("id", "userId", "roleId", "createdAt") VALUES (gen_random_uuid(), $1, $2, NOW())',
          newUser[0].id,
          roleId
        )
      }

      logger.info('Admin user created via init endpoint', { module: 'auth', action: 'init' })
      logs.push('admin 계정 생성 완료')

      return NextResponse.json({
        success: true,
        action: 'created',
        message: '관리자 계정이 생성되었습니다. 기본 비밀번호로 로그인 후 즉시 변경해주세요.',
        logs,
      })
    }

    const admin = users[0]
    logs.push(`admin 존재: id=${admin.id}, isActive=${admin.isActive}`)

    // 비밀번호 리셋
    const newHash = await hash(DEFAULT_PASSWORD, 12)
    await prisma.$executeRawUnsafe(
      'UPDATE "users" SET "passwordHash" = $1, "isActive" = true WHERE "id" = $2',
      newHash,
      admin.id
    )
    logs.push('비밀번호 리셋 완료')

    // 업데이트 후 재검증
    const verifyUsers = await prisma.$queryRawUnsafe<{ passwordHash: string; isActive: boolean }[]>(
      'SELECT "passwordHash", "isActive" FROM "users" WHERE "id" = $1 LIMIT 1',
      admin.id
    )
    if (verifyUsers.length > 0) {
      const finalCompare = await compare(DEFAULT_PASSWORD, verifyUsers[0].passwordHash)
      logs.push(`DB 재검증: ${finalCompare}, isActive: ${verifyUsers[0].isActive}`)
    }

    // 역할 확인
    const roleCheck = await prisma.$queryRawUnsafe<{ roleName: string }[]>(
      'SELECT r."name" as "roleName" FROM "user_roles" ur JOIN "roles" r ON ur."roleId" = r."id" WHERE ur."userId" = $1',
      admin.id
    )
    logs.push(`역할: ${roleCheck.map((r) => r.roleName).join(', ') || '없음'}`)

    logger.info('Admin password reset via init endpoint', { module: 'auth', action: 'init', userId: admin.id })

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

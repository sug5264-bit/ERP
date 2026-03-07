import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash, compare } from 'bcryptjs'

const PASSWORD = 'admin1234'

export async function GET() {
  return initAdmin()
}

export async function POST() {
  return initAdmin()
}

async function initAdmin() {
  const logs: string[] = []

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    logs.push('DB 연결 성공')

    // admin 사용자 조회
    const users = await prisma.$queryRawUnsafe<
      { id: string; username: string; passwordHash: string; isActive: boolean; email: string | null }[]
    >('SELECT "id", "username", "passwordHash", "isActive", "email" FROM "User" WHERE "username" = $1 LIMIT 1', 'admin')

    if (users.length === 0) {
      logs.push('admin 사용자 없음 - 새로 생성')

      const roles = await prisma.$queryRawUnsafe<{ id: string }[]>(
        'SELECT "id" FROM "Role" WHERE "name" = $1 LIMIT 1',
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

      const newHash = await hash(PASSWORD, 10)
      const newUser = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "User" ("id", "username", "email", "passwordHash", "name", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING "id"`,
        'admin',
        'admin@wellgreen.co.kr',
        newHash,
        '관리자'
      )

      if (newUser.length > 0) {
        await prisma.$executeRawUnsafe(
          'INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt") VALUES (gen_random_uuid(), $1, $2, NOW())',
          newUser[0].id,
          roleId
        )
      }

      const verifyCompare = await compare(PASSWORD, newHash)
      logs.push(`비밀번호 검증: ${verifyCompare}`)

      return NextResponse.json({
        success: true,
        action: 'created',
        credentials: { username: 'admin', password: PASSWORD },
        logs,
      })
    }

    const admin = users[0]
    logs.push(`admin 존재: id=${admin.id}, isActive=${admin.isActive}`)

    // 기존 비밀번호 비교 테스트
    const oldCompare = await compare(PASSWORD, admin.passwordHash)
    logs.push(`기존 해시로 비교: ${oldCompare}`)

    // 새 해시 생성 및 업데이트
    const newHash = await hash(PASSWORD, 10)
    const newCompare = await compare(PASSWORD, newHash)
    logs.push(`새 해시 검증: ${newCompare}`)

    await prisma.$executeRawUnsafe(
      'UPDATE "User" SET "passwordHash" = $1, "isActive" = true WHERE "id" = $2',
      newHash,
      admin.id
    )
    logs.push('DB 업데이트 완료')

    // 업데이트 후 재검증
    const verifyUsers = await prisma.$queryRawUnsafe<{ passwordHash: string; isActive: boolean }[]>(
      'SELECT "passwordHash", "isActive" FROM "User" WHERE "id" = $1 LIMIT 1',
      admin.id
    )
    if (verifyUsers.length > 0) {
      const finalCompare = await compare(PASSWORD, verifyUsers[0].passwordHash)
      logs.push(`DB 재검증: ${finalCompare}, isActive: ${verifyUsers[0].isActive}`)
    }

    // 역할 확인
    const roleCheck = await prisma.$queryRawUnsafe<{ roleName: string }[]>(
      'SELECT r."name" as "roleName" FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r."id" WHERE ur."userId" = $1',
      admin.id
    )
    logs.push(`역할: ${roleCheck.map((r) => r.roleName).join(', ') || '없음'}`)

    return NextResponse.json({
      success: true,
      action: 'reset',
      credentials: { username: 'admin', password: PASSWORD },
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

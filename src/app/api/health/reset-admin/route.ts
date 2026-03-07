import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash, compare } from 'bcryptjs'

export async function GET() {
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
      logs.push('admin 사용자가 없음 - 새로 생성합니다')

      const roles = await prisma.$queryRawUnsafe<{ id: string }[]>(
        'SELECT "id" FROM "roles" WHERE "name" = $1 LIMIT 1',
        '관리자'
      )
      let roleId: string
      if (roles.length > 0) {
        roleId = roles[0].id
        logs.push('관리자 역할 존재: ' + roleId)
      } else {
        const newRole = await prisma.role.create({
          data: { name: '관리자', description: '시스템 관리자', isSystem: true },
        })
        roleId = newRole.id
        logs.push('관리자 역할 생성: ' + roleId)
      }

      const newHash = await hash(PASSWORD, 10)
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
        logs.push('admin 계정 생성 완료: ' + newUser[0].id)
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
    logs.push(`admin 사용자 존재: id=${admin.id}, isActive=${admin.isActive}, email=${admin.email}`)

    const oldCompare = await compare(PASSWORD, admin.passwordHash)
    logs.push(`기존 해시로 비교: ${oldCompare}`)

    const newHash = await hash(PASSWORD, 10)
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

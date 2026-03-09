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
    // Check if any users exist
    const userCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*)::bigint as count FROM "users"')
    const hasExistingUsers = userCount.length > 0 && Number(userCount[0].count) > 0

    if (hasExistingUsers) {
      // 기존 유저가 있으면 인증 필요 — 단, 관리자 역할이 아예 없는 경우 예외 허용
      const adminRoleCheck = await prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int as count FROM "user_roles" ur
         JOIN "roles" r ON ur."roleId" = r."id"
         WHERE r."name" = '관리자'`
      )
      const hasAnyAdmin = adminRoleCheck.length > 0 && adminRoleCheck[0].count > 0

      if (hasAnyAdmin) {
        // 관리자가 존재하면 관리자 인증 필요
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
      } else {
        logs.push('경고: 관리자 역할이 할당된 사용자가 없습니다. 비상 복구 모드로 진행합니다.')
      }
    }

    await prisma.$queryRawUnsafe('SELECT 1')
    logs.push('DB 연결 성공')

    // ============================================================
    // 1. 역할(Roles) 확인/생성
    // ============================================================
    const roleDefs = [
      { name: '관리자', description: '시스템 관리자', isSystem: true },
      { name: '일반사용자', description: '일반 사용자', isSystem: false },
      { name: '부서장', description: '부서 관리자', isSystem: false },
      { name: '인사 관리자', description: '인사 모듈 관리자', isSystem: false },
      { name: '재무 관리자', description: '회계/재무 모듈 관리자', isSystem: false },
      { name: '영업 관리자', description: '영업/마감 모듈 관리자', isSystem: false },
    ]

    for (const r of roleDefs) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "roles" ("id", "name", "description", "isSystem", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
           ON CONFLICT ("name") DO NOTHING`,
          r.name,
          r.description,
          r.isSystem
        )
      } catch {
        /* ignore */
      }
    }
    logs.push('역할 확인/생성 완료')

    // ============================================================
    // 2. 권한(Permissions) 생성
    // ============================================================
    const modules = [
      'sales',
      'sales.orders',
      'sales.summary',
      'sales.partners',
      'sales.quotations',
      'sales.deliveries',
      'sales.returns',
      'sales.pricing',
      'purchasing',
      'purchasing.orders',
      'purchasing.receiving',
      'purchasing.suppliers',
      'purchasing.summary',
      'production',
      'production.oem',
      'production.bom',
      'production.plan',
      'production.result',
      'inventory',
      'inventory.items',
      'inventory.stock',
      'inventory.status',
      'inventory.warehouses',
      'inventory.expiry',
      'inventory.lot',
      'quality',
      'quality.incoming',
      'quality.outgoing',
      'quality.standards',
      'closing',
      'closing.sales',
      'closing.purchase',
      'closing.netting',
      'closing.payments',
      'accounting',
      'accounting.vouchers',
      'accounting.journal',
      'accounting.ledger',
      'accounting.financial',
      'accounting.tax',
      'accounting.budget',
      'hr',
      'hr.employees',
      'hr.organization',
      'hr.attendance',
      'hr.leave',
      'hr.payroll',
      'hr.recruitment',
      'projects',
      'approval',
      'approval.draft',
      'approval.pending',
      'approval.completed',
      'approval.rejected',
      'board',
      'board.notices',
      'board.general',
      'board.messages',
      'admin',
      'admin.users',
      'admin.roles',
      'admin.codes',
      'admin.logs',
      'admin.company',
      'admin.settings',
    ]
    const actions = ['read', 'create', 'update', 'delete', 'export', 'import', 'approve']

    let permCreated = 0
    for (const mod of modules) {
      for (const action of actions) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "permissions" ("id", "module", "action", "description")
             VALUES (gen_random_uuid()::text, $1, $2, $3)
             ON CONFLICT ("module", "action") DO NOTHING`,
            mod,
            action,
            `${mod} ${action}`
          )
          permCreated++
        } catch {
          /* ignore */
        }
      }
    }
    logs.push(`권한 데이터 동기화 완료 (${modules.length} 모듈 × ${actions.length} 액션)`)

    // ============================================================
    // 3. 관리자 역할에 모든 권한 할당
    // ============================================================
    try {
      const adminRole = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "roles" WHERE "name" = '관리자' LIMIT 1`
      )
      if (adminRole.length > 0) {
        const roleId = adminRole[0].id
        await prisma.$executeRawUnsafe(
          `INSERT INTO "role_permissions" ("roleId", "permissionId")
           SELECT $1, p."id" FROM "permissions" p
           WHERE NOT EXISTS (
             SELECT 1 FROM "role_permissions" rp WHERE rp."roleId" = $1 AND rp."permissionId" = p."id"
           )`,
          roleId
        )
        logs.push('관리자 역할에 모든 권한 할당 완료')
      }
    } catch (err) {
      logs.push(`관리자 권한 할당 경고: ${(err as Error).message?.slice(0, 80)}`)
    }

    // ============================================================
    // 4. admin 사용자 확인/생성 + 관리자 역할 할당
    // ============================================================
    const users = await prisma.$queryRawUnsafe<
      { id: string; username: string; passwordHash: string; isActive: boolean }[]
    >('SELECT "id", "username", "passwordHash", "isActive" FROM "users" WHERE "username" = $1 LIMIT 1', 'admin')

    let adminUserId: string

    if (users.length === 0) {
      logs.push('admin 사용자 없음 - 새로 생성')
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
      adminUserId = newUser[0].id
      logs.push('admin 계정 생성 완료')
    } else {
      adminUserId = users[0].id
      // 비밀번호 리셋 + 활성화
      const newHash = await hash(DEFAULT_PASSWORD, 12)
      await prisma.$executeRawUnsafe(
        'UPDATE "users" SET "passwordHash" = $1, "isActive" = true WHERE "id" = $2',
        newHash,
        adminUserId
      )
      logs.push(`admin 존재 (id=${adminUserId}), 비밀번호 리셋 완료`)
    }

    // admin 사용자에게 관리자 역할 할당 (없으면 추가)
    try {
      const adminRole = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "roles" WHERE "name" = '관리자' LIMIT 1`
      )
      if (adminRole.length > 0) {
        const roleId = adminRole[0].id
        const existingRole = await prisma.$queryRawUnsafe<{ count: number }[]>(
          `SELECT COUNT(*)::int as count FROM "user_roles" WHERE "userId" = $1 AND "roleId" = $2`,
          adminUserId,
          roleId
        )
        if (existingRole[0]?.count === 0) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "user_roles" ("id", "userId", "roleId", "createdAt")
             VALUES (gen_random_uuid(), $1, $2, NOW())`,
            adminUserId,
            roleId
          )
          logs.push('admin에 관리자 역할 할당 완료 (신규)')
        } else {
          logs.push('admin에 관리자 역할 이미 존재')
        }
      }
    } catch (err) {
      logs.push(`역할 할당 경고: ${(err as Error).message?.slice(0, 80)}`)
    }

    // 최종 검증
    const verifyRoles = await prisma.$queryRawUnsafe<{ roleName: string }[]>(
      `SELECT r."name" as "roleName" FROM "user_roles" ur
       JOIN "roles" r ON ur."roleId" = r."id" WHERE ur."userId" = $1`,
      adminUserId
    )
    const verifyPermCount = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int as count FROM "role_permissions" rp
       JOIN "user_roles" ur ON rp."roleId" = ur."roleId"
       WHERE ur."userId" = $1`,
      adminUserId
    )

    logs.push(`검증 - 역할: ${verifyRoles.map((r) => r.roleName).join(', ') || '없음'}`)
    logs.push(`검증 - 권한 수: ${verifyPermCount[0]?.count || 0}개`)

    logger.info('Admin init completed via health endpoint', { module: 'auth', action: 'init' })

    return NextResponse.json({
      success: true,
      message: '관리자 계정 및 권한이 초기화되었습니다. admin / admin1234 로 로그인해주세요.',
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

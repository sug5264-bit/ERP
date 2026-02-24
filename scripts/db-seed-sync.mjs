#!/usr/bin/env node
/**
 * DB 시드 데이터 동기화 스크립트
 *
 * 빌드/배포 시 자동 실행되며, 핵심 시드 데이터가 없으면 자동으로 적용합니다.
 * 이미 데이터가 있으면 스킵하므로 반복 실행해도 안전합니다.
 *
 * 사용법: node scripts/db-seed-sync.mjs
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

/** 핵심 시드 데이터 존재 여부 확인 */
async function checkSeedDataExists() {
  try {
    // admin 사용자가 존재하는지 확인
    const users = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "users" WHERE "username" = 'admin'`
    )
    if (users[0]?.count > 0) return true

    return false
  } catch {
    // 테이블 자체가 없을 수도 있음
    return false
  }
}

/** 시드 SQL 파일 실행 */
async function applySeedSQL() {
  const seedPath = join(__dirname, '..', 'supabase', '02_seed.sql')
  let sql

  try {
    sql = readFileSync(seedPath, 'utf-8')
  } catch (err) {
    console.log('[db-seed-sync] 02_seed.sql not found, skipping.')
    return false
  }

  // SQL을 세미콜론 기준으로 분리하여 실행
  // 주석 제거 후 각 문장 실행
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  let applied = 0
  for (const stmt of statements) {
    // 순수 주석만 있는 블록 스킵
    const cleaned = stmt
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim()
    if (!cleaned) continue

    try {
      await prisma.$executeRawUnsafe(cleaned + ';')
      applied++
    } catch (err) {
      // ON CONFLICT DO NOTHING이므로 중복 에러는 무시
      // 다른 에러는 로그만 출력하고 계속 진행
      if (
        !err.message?.includes('duplicate') &&
        !err.message?.includes('already exists') &&
        !err.message?.includes('unique constraint')
      ) {
        console.warn(`[db-seed-sync] Warning: ${err.message?.slice(0, 120)}`)
      }
    }
  }

  return applied > 0
}

/** 권한(Permissions) 시드 데이터 적용 - SQL 파일에 없는 부분 */
async function applyPermissions() {
  const modules = [
    'accounting', 'accounting.vouchers', 'accounting.journal', 'accounting.ledger',
    'accounting.financial', 'accounting.tax', 'accounting.budget',
    'hr', 'hr.employees', 'hr.organization', 'hr.attendance',
    'hr.leave', 'hr.payroll', 'hr.recruitment',
    'inventory', 'inventory.items', 'inventory.stock', 'inventory.status', 'inventory.warehouses',
    'sales', 'sales.summary', 'sales.partners', 'sales.quotations', 'sales.orders', 'sales.deliveries',
    'closing', 'closing.netting', 'closing.payments',
    'projects',
    'approval', 'approval.draft', 'approval.pending', 'approval.completed', 'approval.rejected',
    'board', 'board.notices', 'board.general', 'board.messages',
    'admin', 'admin.users', 'admin.roles', 'admin.codes', 'admin.logs', 'admin.company',
  ]
  const actions = ['read', 'create', 'update', 'delete']

  // 권한이 이미 존재하는지 확인
  try {
    const permCount = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "permissions"`
    )
    if (permCount[0]?.count > 10) return // 이미 충분한 권한 데이터 존재
  } catch {
    return // 테이블 없으면 스킵
  }

  console.log('[db-seed-sync] Applying permissions...')

  for (const mod of modules) {
    for (const action of actions) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "permissions" ("id", "module", "action", "description")
           VALUES (gen_random_uuid()::text, $1, $2, $3)
           ON CONFLICT ("module", "action") DO NOTHING`,
          mod, action, `${mod} ${action}`
        )
      } catch { /* ignore */ }
    }
  }

  // 관리자 역할에 모든 권한 할당
  try {
    const adminRole = await prisma.$queryRawUnsafe(
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
    }
  } catch (err) {
    console.warn(`[db-seed-sync] Permissions assignment warning: ${err.message?.slice(0, 80)}`)
  }

  // 부서장 역할 권한
  try {
    const managerRole = await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "roles" WHERE "name" = '부서장' LIMIT 1`
    )
    if (managerRole.length > 0) {
      const roleId = managerRole[0].id
      const managerModules = [
        'inventory', 'sales', 'closing', 'projects', 'hr.leave',
        'approval', 'approval.draft', 'approval.pending', 'approval.completed', 'approval.rejected',
        'board', 'board.notices', 'board.general', 'board.messages',
      ]
      for (const mod of managerModules) {
        for (const action of actions) {
          try {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "role_permissions" ("roleId", "permissionId")
               SELECT $1, p."id" FROM "permissions" p WHERE p."module" = $2 AND p."action" = $3
               ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
              roleId, mod, action
            )
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  // 일반사용자 역할 권한
  try {
    const userRole = await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "roles" WHERE "name" = '일반사용자' LIMIT 1`
    )
    if (userRole.length > 0) {
      const roleId = userRole[0].id
      const userModules = [
        'board', 'board.notices', 'board.general', 'board.messages',
        'approval', 'approval.draft', 'approval.pending', 'approval.completed', 'approval.rejected',
        'projects', 'hr.leave',
      ]
      for (const mod of userModules) {
        for (const action of ['read', 'create']) {
          try {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "role_permissions" ("roleId", "permissionId")
               SELECT $1, p."id" FROM "permissions" p WHERE p."module" = $2 AND p."action" = $3
               ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
              roleId, mod, action
            )
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
}

/** admin 비밀번호를 항상 올바른 값으로 리셋 */
async function ensureAdminPassword() {
  try {
    const adminHash = await hash('admin1234', 10)
    const userHash = await hash('user1234', 10)

    // admin 비밀번호 리셋
    await prisma.$executeRawUnsafe(
      `UPDATE "users" SET "passwordHash" = $1 WHERE "username" = 'admin'`,
      adminHash
    )

    // 일반 사용자 비밀번호도 리셋
    await prisma.$executeRawUnsafe(
      `UPDATE "users" SET "passwordHash" = $1 WHERE "username" IN ('parksales', 'leedev', 'hanacct', 'kangstaff')`,
      userHash
    )

    console.log('[db-seed-sync] Password hashes updated.')
  } catch (err) {
    console.warn(`[db-seed-sync] Password reset warning: ${err.message?.slice(0, 80)}`)
  }
}

async function main() {
  console.log('[db-seed-sync] Checking seed data...')

  const exists = await checkSeedDataExists()
  if (exists) {
    console.log('[db-seed-sync] Seed data already exists. Ensuring passwords are correct...')
    await ensureAdminPassword()
    await applyPermissions()
    await prisma.$disconnect()
    return
  }

  console.log('[db-seed-sync] No seed data found. Applying seed data...')

  const applied = await applySeedSQL()
  if (applied) {
    console.log('[db-seed-sync] Seed SQL applied successfully.')
  }

  // SQL 시드 적용 후에도 비밀번호 리셋 (해시 호환성 보장)
  await ensureAdminPassword()
  await applyPermissions()
  console.log('[db-seed-sync] Seed data sync completed.')
  console.log('[db-seed-sync] Login: admin / admin1234')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[db-seed-sync] Error:', e.message)
  prisma.$disconnect()
  process.exit(1)
})

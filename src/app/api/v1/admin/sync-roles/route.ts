import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'

/**
 * POST /api/v1/admin/sync-roles
 * 관리자 전용: 역할/권한 동기화
 * - 누락된 역할 생성
 * - 누락된 권한(module+action) 생성
 * - 각 역할에 지정된 권한 할당
 */
export async function POST() {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const modules = [
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
      'inventory',
      'inventory.items',
      'inventory.stock',
      'inventory.status',
      'inventory.warehouses',
      'sales',
      'sales.summary',
      'sales.partners',
      'sales.quotations',
      'sales.orders',
      'sales.deliveries',
      'closing',
      'closing.netting',
      'closing.payments',
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
    ]
    const actions = ['read', 'create', 'update', 'delete', 'export', 'import', 'approve']

    // 1. 모든 권한 upsert
    const permMap: Record<string, string> = {}
    for (const mod of modules) {
      for (const action of actions) {
        const perm = await prisma.permission.upsert({
          where: { module_action: { module: mod, action } },
          update: {},
          create: { module: mod, action, description: `${mod} ${action}` },
        })
        permMap[`${mod}:${action}`] = perm.id
      }
    }

    // 2. 역할 upsert
    const roles: Record<string, string> = {}
    const roleDefs = [
      { name: '관리자', description: '시스템 관리자', isSystem: true },
      { name: '일반사용자', description: '일반 사용자' },
      { name: '부서장', description: '부서 관리자' },
      { name: '인사 관리자', description: '인사 모듈 관리자' },
      { name: '재무 관리자', description: '회계/재무 모듈 관리자' },
      { name: '영업 관리자', description: '영업/마감 모듈 관리자' },
    ]
    for (const r of roleDefs) {
      const role = await prisma.role.upsert({
        where: { name: r.name },
        update: {},
        create: r,
      })
      roles[r.name] = role.id
    }

    // 3. 역할별 권한 할당 정의
    async function assignPerms(roleId: string, mods: string[], acts: string[]) {
      for (const mod of mods) {
        for (const action of acts) {
          const permId = permMap[`${mod}:${action}`]
          if (!permId) continue
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId, permissionId: permId } },
            update: {},
            create: { roleId, permissionId: permId },
          })
        }
      }
    }

    const commonModules = [
      'board',
      'board.notices',
      'board.general',
      'board.messages',
      'approval',
      'approval.draft',
      'approval.pending',
      'approval.completed',
      'approval.rejected',
      'projects',
    ]

    // 관리자: 전체
    await assignPerms(roles['관리자'], modules, actions)

    // 인사 관리자: HR 전체 + 공통(읽기/생성)
    await assignPerms(
      roles['인사 관리자'],
      ['hr', 'hr.employees', 'hr.organization', 'hr.attendance', 'hr.payroll', 'hr.recruitment'],
      actions
    )
    await assignPerms(roles['인사 관리자'], commonModules, ['read', 'create'])

    // 재무 관리자: 회계+마감 전체 + 공통(읽기/생성)
    await assignPerms(
      roles['재무 관리자'],
      [
        'accounting',
        'accounting.vouchers',
        'accounting.journal',
        'accounting.ledger',
        'accounting.financial',
        'accounting.tax',
        'accounting.budget',
        'closing',
        'closing.netting',
        'closing.payments',
      ],
      actions
    )
    await assignPerms(roles['재무 관리자'], commonModules, ['read', 'create'])

    // 영업 관리자: 영업+마감 전체 + 재고 읽기 + 공통(읽기/생성)
    await assignPerms(
      roles['영업 관리자'],
      [
        'sales',
        'sales.summary',
        'sales.partners',
        'sales.quotations',
        'sales.orders',
        'sales.deliveries',
        'closing',
        'closing.netting',
        'closing.payments',
      ],
      actions
    )
    await assignPerms(
      roles['영업 관리자'],
      ['inventory', 'inventory.items', 'inventory.stock', 'inventory.status', 'inventory.warehouses'],
      ['read']
    )
    await assignPerms(roles['영업 관리자'], commonModules, ['read', 'create'])

    // 부서장: 재고/영업/마감/프로젝트/휴가/게시판/결재 전체
    await assignPerms(
      roles['부서장'],
      [
        'inventory',
        'sales',
        'closing',
        'projects',
        'hr.leave',
        'approval',
        'approval.draft',
        'approval.pending',
        'approval.completed',
        'approval.rejected',
        'board',
        'board.notices',
        'board.general',
        'board.messages',
      ],
      actions
    )

    // 일반사용자: 게시판/결재/프로젝트/휴가 읽기/생성
    await assignPerms(roles['일반사용자'], [...commonModules, 'hr.leave'], ['read', 'create'])

    return successResponse({
      message: '역할 및 권한 동기화 완료',
      rolesCreated: Object.keys(roles).length,
      permissionsCreated: Object.keys(permMap).length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

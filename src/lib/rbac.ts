import { auth } from '@/lib/auth'

type Action = 'read' | 'create' | 'update' | 'delete' | 'export' | 'import' | 'approve'

interface Permission {
  module: string
  action: string
}

/**
 * 모듈-경로 매핑: URL 경로로부터 필요한 모듈/권한을 판별
 */
const ROUTE_MODULE_MAP: Record<string, string> = {
  '/accounting': 'accounting',
  '/hr': 'hr',
  '/inventory': 'inventory',
  '/sales': 'sales',
  '/approval': 'approval',
  '/board': 'board',
  '/projects': 'projects',
  '/admin': 'admin',
}

/**
 * HTTP 메서드 → 권한 액션 매핑
 */
const METHOD_ACTION_MAP: Record<string, Action> = {
  GET: 'read',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
}

/**
 * 경로에서 필요 모듈 추출
 */
export function getModuleFromPath(pathname: string): string | null {
  // /api/v1/hr/employees → hr
  const cleaned = pathname.replace(/^\/api\/v1/, '')
  for (const [prefix, module] of Object.entries(ROUTE_MODULE_MAP)) {
    if (cleaned.startsWith(prefix)) return module
  }
  return null
}

/**
 * 서버사이드 권한 체크 (API route에서 사용)
 */
export function hasPermission(
  permissions: Permission[],
  roles: string[],
  module: string,
  action: Action
): boolean {
  // 시스템 관리자는 모든 권한
  if (roles.includes('SYSTEM_ADMIN') || roles.includes('관리자')) return true
  // 부서장은 읽기/승인 가능
  if (roles.includes('부서장') && (action === 'read' || action === 'approve')) return true

  return permissions.some((p) => p.module === module && p.action === action)
}

/**
 * API 핸들러용 권한 검증 헬퍼
 * - session이 없으면 401
 * - 권한이 없으면 403
 * - 통과하면 session 반환
 */
export async function requirePermission(module: string, action: Action) {
  const session = await auth()
  if (!session?.user) {
    return { error: 'UNAUTHORIZED' as const, status: 401, session: null }
  }

  const user = session.user as any
  const permissions: Permission[] = user.permissions || []
  const roles: string[] = user.roles || []

  if (!hasPermission(permissions, roles, module, action)) {
    return { error: 'FORBIDDEN' as const, status: 403, session: null }
  }

  return { error: null, status: 200, session }
}

/**
 * API route에서 메서드 기반 자동 권한 체크
 */
export async function checkRoutePermission(pathname: string, method: string) {
  const module = getModuleFromPath(pathname)
  if (!module) return { error: null, status: 200, session: await auth() }

  const action = METHOD_ACTION_MAP[method] || 'read'
  return requirePermission(module, action)
}

/**
 * 클라이언트에서 사용할 권한 체크 유틸리티
 */
export function checkClientPermission(
  userPermissions: Permission[],
  userRoles: string[],
  module: string,
  action: Action
): boolean {
  return hasPermission(userPermissions, userRoles, module, action)
}

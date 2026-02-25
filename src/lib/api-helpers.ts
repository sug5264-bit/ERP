import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { hasPermission } from '@/lib/rbac'
import { logger } from '@/lib/logger'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  meta?: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

type Action = 'read' | 'create' | 'update' | 'delete' | 'export' | 'import' | 'approve'

interface Permission {
  module: string
  action: string
}

interface SessionUser {
  id: string
  email?: string | null
  name?: string | null
  roles: string[]
  permissions: Permission[]
  employeeId?: string | null
  employeeName?: string | null
  departmentName?: string | null
  positionName?: string | null
}

export interface AuthResult {
  session: { user: SessionUser }
}

export function successResponse<T>(data: T, meta?: ApiResponse['meta'], options?: { cache?: string }) {
  const headers: Record<string, string> = {}
  if (options?.cache) {
    headers['Cache-Control'] = options.cache
  }
  return NextResponse.json({ success: true, data, meta }, { headers })
}

export function errorResponse(message: string, code: string = 'ERROR', status: number = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status })
}

export function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const safeIssues = error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }))
    return errorResponse('입력값이 올바르지 않습니다.', 'VALIDATION_ERROR', 400, safeIssues)
  }

  // Prisma 에러 처리 (DB 내부 정보 노출 방지)
  if (isPrismaError(error)) {
    const prismaMessage = getPrismaErrorMessage(error)
    logger.error('Prisma Error', {
      code: (error as any).code,
      error: error instanceof Error ? error.message : String(error),
    })
    return errorResponse(prismaMessage, 'DATABASE_ERROR', 400)
  }

  // 일반 에러는 내부 정보 노출 방지 (로그에만 상세 기록)
  if (error instanceof Error) {
    logger.error('API Error', {
      error: error.message,
      stack: error.stack,
    })
    return errorResponse('서버 오류가 발생했습니다.', 'INTERNAL_ERROR', 500)
  }

  logger.error('API Error', { error: String(error) })
  return errorResponse('서버 오류가 발생했습니다.', 'INTERNAL_ERROR', 500)
}

function isPrismaError(error: unknown): boolean {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    (error as any).code.startsWith('P')
  )
}

function getPrismaErrorMessage(error: unknown): string {
  const code = (error as any).code as string
  const meta = (error as any).meta
  switch (code) {
    case 'P2002':
      return '이미 존재하는 데이터입니다. 중복된 값을 확인해주세요.'
    case 'P2003':
      return `참조하는 데이터가 존재하지 않습니다.${meta?.field_name ? ` (${meta.field_name})` : ''}`
    case 'P2025':
      return '해당 데이터를 찾을 수 없습니다.'
    case 'P2010':
    case 'P2022':
      return '데이터베이스 스키마가 최신이 아닙니다. 관리자에게 DB 마이그레이션을 요청하세요.'
    default:
      return `데이터 처리 중 오류가 발생했습니다. (${code})`
  }
}

export async function getSession() {
  const session = await auth()
  if (!session?.user) {
    return null
  }
  return session
}

/**
 * 인증 검증 헬퍼
 * 실패 시 NextResponse(401) 반환, 성공 시 { session } 반환
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
  }
  const user = session.user as Record<string, unknown>
  return {
    session: {
      user: {
        id: user.id as string,
        email: user.email as string | null,
        name: user.name as string | null,
        roles: (user.roles as string[]) || [],
        permissions: (user.permissions as Permission[]) || [],
        employeeId: user.employeeId as string | null,
        employeeName: user.employeeName as string | null,
        departmentName: user.departmentName as string | null,
        positionName: user.positionName as string | null,
      },
    },
  }
}

/**
 * 특정 모듈의 특정 액션에 대한 권한 검증
 */
export async function requirePermissionCheck(module: string, action: Action): Promise<AuthResult | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  const { session } = result
  if (!hasPermission(session.user.permissions, session.user.roles, module, action)) {
    logger.warn('Permission denied', {
      userId: session.user.id,
      module,
      action,
      roles: session.user.roles,
    })
    return errorResponse('권한이 없습니다.', 'FORBIDDEN', 403)
  }

  return result
}

/**
 * 관리자 전용 엔드포인트 권한 검증
 */
export async function requireAdmin(): Promise<AuthResult | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  const { session } = result
  const isAdmin = session.user.roles.includes('SYSTEM_ADMIN') || session.user.roles.includes('관리자')
  if (!isAdmin) {
    logger.warn('Admin access denied', {
      userId: session.user.id,
      roles: session.user.roles,
    })
    return errorResponse('관리자 권한이 필요합니다.', 'FORBIDDEN', 403)
  }

  return result
}

/** NextResponse인지 확인하는 타입 가드 */
export function isErrorResponse(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const rawPage = parseInt(searchParams.get('page') || '1', 10)
  const rawSize = parseInt(searchParams.get('pageSize') || '20', 10)
  const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1)
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(rawSize) ? rawSize : 20))
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip }
}

export function buildMeta(page: number, pageSize: number, totalCount: number) {
  return {
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  }
}

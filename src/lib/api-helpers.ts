import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
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

// ─── Request ID 생성 ───
let requestCounter = 0

export function generateRequestId(): string {
  const ts = Date.now().toString(36)
  const seq = (requestCounter++ & 0xffff).toString(36).padStart(3, '0')
  const rand = Math.random().toString(36).slice(2, 6)
  return `${ts}-${seq}-${rand}`
}

/** 요청에서 Request ID 추출 또는 생성 */
export function getRequestId(req?: NextRequest | Request): string {
  const fromHeader = req?.headers?.get('x-request-id')
  return fromHeader || generateRequestId()
}

// ─── API 요청 성능 메트릭 ───
interface ApiMetrics {
  totalRequests: number
  errorCount: number
  avgResponseTime: number
  maxResponseTime: number
  statusCodes: Record<number, number>
  lastReset: number
}

const apiMetrics: ApiMetrics = {
  totalRequests: 0,
  errorCount: 0,
  avgResponseTime: 0,
  maxResponseTime: 0,
  statusCodes: {},
  lastReset: Date.now(),
}

export function getApiMetrics(): ApiMetrics & { uptimeMinutes: number } {
  return {
    ...apiMetrics,
    statusCodes: { ...apiMetrics.statusCodes },
    uptimeMinutes: Math.round((Date.now() - apiMetrics.lastReset) / 60_000),
  }
}

export function resetApiMetrics(): void {
  apiMetrics.totalRequests = 0
  apiMetrics.errorCount = 0
  apiMetrics.avgResponseTime = 0
  apiMetrics.maxResponseTime = 0
  apiMetrics.statusCodes = {}
  apiMetrics.lastReset = Date.now()
}

function recordMetric(status: number, durationMs: number): void {
  apiMetrics.totalRequests++
  apiMetrics.statusCodes[status] = (apiMetrics.statusCodes[status] || 0) + 1
  if (status >= 400) apiMetrics.errorCount++
  apiMetrics.avgResponseTime += (durationMs - apiMetrics.avgResponseTime) / apiMetrics.totalRequests
  if (durationMs > apiMetrics.maxResponseTime) apiMetrics.maxResponseTime = durationMs
}

// ─── 응답 헬퍼 ───

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
      code: error.code,
      error: 'message' in error ? String((error as { message?: string }).message) : String(error),
    })
    return errorResponse(prismaMessage, 'DATABASE_ERROR', 400)
  }

  // 비즈니스 로직 에러 (트랜잭션 내부에서 throw된 사용자 메시지)
  if (error instanceof Error) {
    const msg = error.message
    if (
      msg.includes('부족합니다') ||
      msg.includes('올바르지 않습니다') ||
      msg.includes('필요합니다') ||
      msg.includes('없습니다') ||
      msg.includes('초과') ||
      msg.includes('0보다') ||
      msg.includes('할 수 없습니다') ||
      msg.includes('이미 존재') ||
      msg.includes('일치하지 않습니다')
    ) {
      return errorResponse(msg, 'BUSINESS_ERROR', 400)
    }
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

interface PrismaError {
  code: string
  meta?: { field_name?: string }
}

function isPrismaError(error: unknown): error is PrismaError {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    ((error as Record<string, unknown>).code as string).startsWith('P')
  )
}

function getPrismaErrorMessage(error: PrismaError): string {
  const code = error.code
  const meta = error.meta
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

// ─── API 핸들러 래퍼 (요청 추적 + 성능 측정 + 에러 핸들링) ───

type RouteContext = { params: Promise<Record<string, string>> }
type ApiHandler = (req: NextRequest, ctx?: RouteContext) => Promise<NextResponse>

/**
 * API Route 핸들러를 래핑하여 요청 추적, 성능 측정, 에러 핸들링을 자동화합니다.
 *
 * @example
 * export const GET = withApiHandler(async (req) => {
 *   const authResult = await requireAuth()
 *   if (isErrorResponse(authResult)) return authResult
 *   return successResponse({ message: 'ok' })
 * })
 */
export function withApiHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, ctx?: RouteContext) => {
    const requestId = getRequestId(req)
    const startTime = performance.now()
    const method = req.method
    const path = req.nextUrl.pathname

    try {
      const response = await handler(req, ctx)
      const duration = Math.round(performance.now() - startTime)

      // 성능 메트릭 기록
      recordMetric(response.status, duration)

      // 응답 헤더에 요청 ID 및 처리 시간 추가
      response.headers.set('X-Request-Id', requestId)
      response.headers.set('X-Response-Time', `${duration}ms`)

      // 느린 API 경고 (500ms 이상)
      if (duration > 500) {
        logger.warn('Slow API response', {
          requestId,
          method,
          path,
          status: response.status,
          duration: `${duration}ms`,
        })
      }

      return response
    } catch (error) {
      const duration = Math.round(performance.now() - startTime)
      recordMetric(500, duration)

      logger.error('Unhandled API error', {
        requestId,
        method,
        path,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      const response = handleApiError(error)
      response.headers.set('X-Request-Id', requestId)
      response.headers.set('X-Response-Time', `${duration}ms`)
      return response
    }
  }
}

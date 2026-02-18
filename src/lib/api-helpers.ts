import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'

export interface ApiResponse<T = any> {
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
    details?: any
  }
}

export function successResponse<T>(data: T, meta?: ApiResponse['meta'], options?: { cache?: string }) {
  const headers: Record<string, string> = {}
  if (options?.cache) {
    headers['Cache-Control'] = options.cache
  }
  return NextResponse.json({ success: true, data, meta }, { headers })
}

export function errorResponse(
  message: string,
  code: string = 'ERROR',
  status: number = 400,
  details?: any
) {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status }
  )
}

export function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    // 검증 에러: 안전한 필드 정보만 노출
    const safeIssues = error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }))
    return errorResponse(
      '입력값이 올바르지 않습니다.',
      'VALIDATION_ERROR',
      400,
      safeIssues
    )
  }

  // 프로덕션에서는 내부 에러 메시지 숨김
  const isDev = process.env.NODE_ENV === 'development'
  const message = isDev && error instanceof Error
    ? error.message
    : '서버 오류가 발생했습니다.'

  console.error('API Error:', error)
  return errorResponse(message, 'INTERNAL_ERROR', 500)
}

export async function getSession() {
  const session = await auth()
  if (!session?.user) {
    return null
  }
  return session
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const rawPage = parseInt(searchParams.get('page') || '1')
  const rawSize = parseInt(searchParams.get('pageSize') || '20')
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

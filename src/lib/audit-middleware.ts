import { NextRequest, NextResponse } from 'next/server'
import { writeAuditLog, getClientIp } from '@/lib/audit-log'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'APPROVE' | 'REJECT'

/**
 * HTTP 메서드 → 감사 액션 매핑
 */
const METHOD_AUDIT_ACTION: Record<string, AuditAction> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
}

interface AuditOptions {
  tableName: string
  getRecordId?: (req: NextRequest, response: Record<string, unknown>) => string | undefined
  getOldValue?: (req: Request) => Promise<unknown>
  action?: AuditAction
}

/**
 * API 핸들러 래퍼: 변경 작업(POST/PUT/PATCH/DELETE) 시 자동 감사 로그 기록
 *
 * 사용법:
 * ```ts
 * export const POST = withAuditLog(
 *   { tableName: 'employees' },
 *   async (req) => {
 *     // 기존 핸들러 로직
 *     return successResponse(data)
 *   }
 * )
 * ```
 */
export function withAuditLog(
  options: AuditOptions,
  handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    const method = req.method
    const auditAction = options.action || METHOD_AUDIT_ACTION[method]

    // GET 요청이고 명시적 action이 없으면 로깅 스킵
    if (!auditAction) {
      return handler(req, ...args)
    }

    // 변경 전 값 캡처 (UPDATE/DELETE 시)
    // getOldValue에 cloned request를 전달하여 원본 body 보존
    let oldValue: unknown = undefined
    if ((auditAction === 'UPDATE' || auditAction === 'DELETE') && options.getOldValue) {
      try {
        oldValue = await options.getOldValue(req.clone())
      } catch {
        // 캡처 실패해도 원래 작업은 진행
      }
    }

    // 핸들러 실행
    const response = await handler(req, ...args)

    // 성공 응답인 경우만 로깅 (2xx)
    if (response.status >= 200 && response.status < 300) {
      const ipAddress = getClientIp(req)

      // response body에서 recordId 추출
      let recordId: string | undefined
      let newValue: unknown = undefined

      try {
        const cloned = response.clone()
        const body = await cloned.json()
        if (body.success && body.data) {
          recordId = options.getRecordId ? options.getRecordId(req, body.data) : body.data.id
          newValue = { id: recordId }
        }
      } catch {
        // parse 실패 시 무시
      }

      // 비동기로 감사 로그 기록 (응답 지연 방지)
      writeAuditLog({
        action: auditAction,
        tableName: options.tableName,
        recordId,
        oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
        newValue: newValue ? JSON.stringify(newValue) : undefined,
        ipAddress,
      }).catch((e) => console.error('Audit log failed:', e))
    }

    return response
  }
}

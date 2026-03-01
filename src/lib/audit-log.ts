import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'

interface AuditLogParams {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'APPROVE' | 'REJECT'
  tableName: string
  recordId?: string
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
}

/**
 * 감사 로그 자동 기록 유틸리티
 * API route handler 내에서 호출하면 됩니다.
 */
export async function writeAuditLog(params: AuditLogParams) {
  try {
    const session = await auth()
    const userId = session?.user?.id || null

    await prisma.auditLog.create({
      data: {
        userId,
        action: params.action,
        tableName: params.tableName,
        recordId: params.recordId || null,
        oldValue: params.oldValue || undefined,
        newValue: params.newValue || undefined,
        ipAddress: params.ipAddress || null,
      },
    })
  } catch (error) {
    // 감사 로그 기록 실패해도 원래 작업은 계속 진행
    logger.error('Audit log write failed', { error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * 요청에서 IP 추출
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '0.0.0.0'
}

/**
 * 알림 생성 유틸리티 (결재/휴가 등에서 사용)
 */
export async function createNotification(params: {
  userId: string
  type: string
  title: string
  message: string
  relatedUrl?: string
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedUrl: params.relatedUrl || null,
      },
    })
  } catch (error) {
    logger.error('Notification create failed', { error: error instanceof Error ? error.message : String(error) })
  }
}

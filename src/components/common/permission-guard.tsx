'use client'

import { useSession } from 'next-auth/react'
import { checkClientPermission } from '@/lib/rbac'
import { type ReactNode } from 'react'

type Action = 'read' | 'create' | 'update' | 'delete' | 'export' | 'import' | 'approve'

interface PermissionGuardProps {
  module: string
  action: Action
  children: ReactNode
  fallback?: ReactNode
}

/**
 * 권한 기반 UI 보호 컴포넌트
 *
 * 사용 예:
 * <PermissionGuard module="hr" action="create">
 *   <Button>사원 등록</Button>
 * </PermissionGuard>
 */
export function PermissionGuard({ module, action, children, fallback = null }: PermissionGuardProps) {
  const { data: session } = useSession()

  if (!session?.user) return fallback

  const user = session.user as Record<string, unknown>
  const permissions = (user.permissions as { module: string; action: string }[]) || []
  const roles = (user.roles as string[]) || []

  if (!checkClientPermission(permissions, roles, module, action)) {
    return fallback
  }

  return <>{children}</>
}

/**
 * 권한 체크 훅
 */
export function usePermission(module: string, action: Action): boolean {
  const { data: session } = useSession()
  if (!session?.user) return false

  const user = session.user as Record<string, unknown>
  return checkClientPermission(
    (user.permissions as { module: string; action: string }[]) || [],
    (user.roles as string[]) || [],
    module,
    action
  )
}

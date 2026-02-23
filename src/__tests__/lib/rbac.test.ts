import { describe, it, expect, vi } from 'vitest'

// next-auth의 auth() 함수가 Next.js 런타임에 의존하므로 모킹
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

import { hasPermission, getModuleFromPath } from '@/lib/rbac'

describe('RBAC - hasPermission', () => {
  it('SYSTEM_ADMIN은 모든 권한을 가짐', () => {
    expect(hasPermission([], ['SYSTEM_ADMIN'], 'hr', 'delete')).toBe(true)
    expect(hasPermission([], ['SYSTEM_ADMIN'], 'admin', 'create')).toBe(true)
    expect(hasPermission([], ['SYSTEM_ADMIN'], 'accounting', 'read')).toBe(true)
  })

  it('관리자 역할은 모든 권한을 가짐', () => {
    expect(hasPermission([], ['관리자'], 'hr', 'delete')).toBe(true)
    expect(hasPermission([], ['관리자'], 'admin', 'create')).toBe(true)
  })

  it('부서장은 읽기/승인만 가능', () => {
    expect(hasPermission([], ['부서장'], 'hr', 'read')).toBe(true)
    expect(hasPermission([], ['부서장'], 'hr', 'approve')).toBe(true)
    expect(hasPermission([], ['부서장'], 'hr', 'delete')).toBe(false)
    expect(hasPermission([], ['부서장'], 'hr', 'create')).toBe(false)
  })

  it('일반 사용자는 명시적 권한만 허용', () => {
    const permissions = [
      { module: 'board', action: 'read' },
      { module: 'board', action: 'create' },
    ]
    expect(hasPermission(permissions, ['일반사용자'], 'board', 'read')).toBe(true)
    expect(hasPermission(permissions, ['일반사용자'], 'board', 'create')).toBe(true)
    expect(hasPermission(permissions, ['일반사용자'], 'board', 'delete')).toBe(false)
    expect(hasPermission(permissions, ['일반사용자'], 'admin', 'read')).toBe(false)
  })

  it('권한이 없는 사용자는 거부', () => {
    expect(hasPermission([], [], 'hr', 'read')).toBe(false)
    expect(hasPermission([], ['일반사용자'], 'hr', 'read')).toBe(false)
  })

  it('여러 역할을 가진 사용자', () => {
    const permissions = [
      { module: 'hr', action: 'read' },
      { module: 'hr', action: 'create' },
    ]
    expect(hasPermission(permissions, ['일반사용자', '인사 관리자'], 'hr', 'read')).toBe(true)
    expect(hasPermission(permissions, ['일반사용자', '인사 관리자'], 'hr', 'create')).toBe(true)
  })
})

describe('RBAC - getModuleFromPath', () => {
  it('API 경로에서 모듈 추출', () => {
    expect(getModuleFromPath('/api/v1/hr/employees')).toBe('hr')
    expect(getModuleFromPath('/api/v1/accounting/vouchers')).toBe('accounting')
    expect(getModuleFromPath('/api/v1/inventory/items')).toBe('inventory')
    expect(getModuleFromPath('/api/v1/sales/orders')).toBe('sales')
    expect(getModuleFromPath('/api/v1/admin/users')).toBe('admin')
    expect(getModuleFromPath('/api/v1/projects/123')).toBe('projects')
  })

  it('매핑되지 않은 경로는 null 반환', () => {
    expect(getModuleFromPath('/api/v1/dashboard/stats')).toBe(null)
    expect(getModuleFromPath('/api/v1/search')).toBe(null)
    expect(getModuleFromPath('/api/v1/notifications')).toBe(null)
  })
})

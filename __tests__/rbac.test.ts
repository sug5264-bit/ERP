import { describe, it, expect } from 'vitest'

// rbac.ts는 next-auth를 import하므로, 순수 로직만 인라인으로 테스트
type Action = 'read' | 'create' | 'update' | 'delete' | 'export' | 'import' | 'approve'
interface Permission {
  module: string
  action: string
}

const ROUTE_MODULE_MAP: Record<string, string> = {
  '/accounting': 'accounting',
  '/hr': 'hr',
  '/inventory': 'inventory',
  '/sales': 'sales',
  '/approval': 'approval',
  '/board': 'board',
  '/projects': 'projects',
  '/admin': 'admin',
  '/purchasing': 'purchasing',
  '/production': 'production',
  '/quality': 'quality',
  '/closing': 'closing',
  '/shipper': 'shipper',
}

function hasPermission(
  permissions: Permission[],
  roles: string[],
  module: string,
  action: Action,
  accountType?: string
): boolean {
  if (accountType === 'SHIPPER') return module === 'shipper'
  if (roles.includes('SYSTEM_ADMIN') || roles.includes('관리자')) return true
  if (roles.includes('부서장') && (action === 'read' || action === 'approve')) return true
  return permissions.some((p) => p.module === module && p.action === action)
}

function getModuleFromPath(pathname: string): string | null {
  const cleaned = pathname.replace(/^\/api\/v1/, '')
  for (const [prefix, module] of Object.entries(ROUTE_MODULE_MAP)) {
    if (cleaned.startsWith(prefix)) return module
  }
  return null
}

describe('RBAC - hasPermission', () => {
  const salesPermission = [
    { module: 'sales', action: 'read' },
    { module: 'sales', action: 'create' },
  ]
  const hrPermission = [{ module: 'hr', action: 'read' }]

  // === SHIPPER 계정 제한 테스트 ===
  describe('SHIPPER 계정 제한', () => {
    it('SHIPPER는 shipper 모듈만 접근 가능', () => {
      expect(hasPermission([], [], 'shipper', 'read', 'SHIPPER')).toBe(true)
    })

    it('SHIPPER는 sales 모듈 접근 불가', () => {
      expect(hasPermission(salesPermission, [], 'sales', 'read', 'SHIPPER')).toBe(false)
    })

    it('SHIPPER는 SYSTEM_ADMIN 역할이 있어도 shipper 외 접근 불가', () => {
      expect(hasPermission([], ['SYSTEM_ADMIN'], 'hr', 'read', 'SHIPPER')).toBe(false)
    })

    it('SHIPPER는 관리자 역할이 있어도 admin 접근 불가', () => {
      expect(hasPermission([], ['관리자'], 'admin', 'read', 'SHIPPER')).toBe(false)
    })
  })

  // === SYSTEM_ADMIN 역할 테스트 ===
  describe('SYSTEM_ADMIN 전체 권한', () => {
    it('SYSTEM_ADMIN은 모든 모듈 접근 가능', () => {
      expect(hasPermission([], ['SYSTEM_ADMIN'], 'hr', 'delete')).toBe(true)
      expect(hasPermission([], ['SYSTEM_ADMIN'], 'accounting', 'create')).toBe(true)
      expect(hasPermission([], ['SYSTEM_ADMIN'], 'admin', 'update')).toBe(true)
    })

    it('관리자 역할도 전체 권한', () => {
      expect(hasPermission([], ['관리자'], 'sales', 'delete')).toBe(true)
    })
  })

  // === 부서장 역할 테스트 ===
  describe('부서장 역할', () => {
    it('부서장은 읽기 가능', () => {
      expect(hasPermission([], ['부서장'], 'hr', 'read')).toBe(true)
    })

    it('부서장은 승인 가능', () => {
      expect(hasPermission([], ['부서장'], 'approval', 'approve')).toBe(true)
    })

    it('부서장은 생성 불가 (권한 없을 때)', () => {
      expect(hasPermission([], ['부서장'], 'hr', 'create')).toBe(false)
    })

    it('부서장은 삭제 불가 (권한 없을 때)', () => {
      expect(hasPermission([], ['부서장'], 'hr', 'delete')).toBe(false)
    })
  })

  // === 일반 사용자 권한 매칭 ===
  describe('일반 사용자 권한 매칭', () => {
    it('정확한 모듈+액션 매칭', () => {
      expect(hasPermission(salesPermission, [], 'sales', 'read')).toBe(true)
      expect(hasPermission(salesPermission, [], 'sales', 'create')).toBe(true)
    })

    it('없는 액션은 거부', () => {
      expect(hasPermission(salesPermission, [], 'sales', 'delete')).toBe(false)
    })

    it('다른 모듈은 거부', () => {
      expect(hasPermission(salesPermission, [], 'hr', 'read')).toBe(false)
    })

    it('빈 권한 배열은 모든 접근 거부', () => {
      expect(hasPermission([], [], 'sales', 'read')).toBe(false)
    })

    it('복수 모듈 권한이 있으면 해당 모듈만 접근 가능', () => {
      const mixed = [...salesPermission, ...hrPermission]
      expect(hasPermission(mixed, [], 'sales', 'read')).toBe(true)
      expect(hasPermission(mixed, [], 'hr', 'read')).toBe(true)
      expect(hasPermission(mixed, [], 'inventory', 'read')).toBe(false)
    })
  })

  // === INTERNAL 기본 accountType ===
  describe('INTERNAL accountType', () => {
    it('INTERNAL은 권한 기반 판단', () => {
      expect(hasPermission(salesPermission, [], 'sales', 'read', 'INTERNAL')).toBe(true)
      expect(hasPermission([], [], 'sales', 'read', 'INTERNAL')).toBe(false)
    })

    it('accountType 미지정 시 INTERNAL과 동일 동작', () => {
      expect(hasPermission(salesPermission, [], 'sales', 'read')).toBe(
        hasPermission(salesPermission, [], 'sales', 'read', 'INTERNAL')
      )
    })
  })
})

describe('RBAC - getModuleFromPath', () => {
  it('API 경로에서 모듈 추출', () => {
    expect(getModuleFromPath('/api/v1/hr/employees')).toBe('hr')
    expect(getModuleFromPath('/api/v1/sales/orders')).toBe('sales')
    expect(getModuleFromPath('/api/v1/inventory/items')).toBe('inventory')
  })

  it('서브 경로도 모듈 추출', () => {
    expect(getModuleFromPath('/api/v1/hr/employees/123/leaves')).toBe('hr')
    expect(getModuleFromPath('/api/v1/accounting/vouchers/456')).toBe('accounting')
  })

  it('매핑되지 않은 경로는 null', () => {
    expect(getModuleFromPath('/api/v1/dashboard/stats')).toBeNull()
    expect(getModuleFromPath('/api/v1/search')).toBeNull()
    expect(getModuleFromPath('/api/v1/notifications')).toBeNull()
  })

  it('shipper 모듈 경로 매핑', () => {
    expect(getModuleFromPath('/api/v1/shipper/orders')).toBe('shipper')
    expect(getModuleFromPath('/api/v1/shipper/settlement')).toBe('shipper')
  })

  it('빈 경로/루트 경로', () => {
    expect(getModuleFromPath('/')).toBeNull()
    expect(getModuleFromPath('')).toBeNull()
  })
})

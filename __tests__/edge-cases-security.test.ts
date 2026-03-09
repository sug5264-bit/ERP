import { describe, it, expect } from 'vitest'

// ─── XSS / SQL Injection 방어 ────────────────────────
// sanitize.ts의 sanitizeSearchQuery 로직 복제
// 실제 sanitize.ts 구현과 동일
function sanitizeString(input: string): string {
  return input
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .replace(/\s{2,}/g, ' ')
}

function sanitizeSearchQuery(input: string): string {
  return sanitizeString(input)
    .replace(/[%_\\]/g, (char) => `\\${char}`)
    .slice(0, 100)
}

describe('입력값 Sanitize', () => {
  describe('SQL 와일드카드 이스케이프', () => {
    it('% 와일드카드 이스케이프', () => {
      expect(sanitizeSearchQuery('test%admin')).toBe('test\\%admin')
    })

    it('_ 와일드카드 이스케이프', () => {
      expect(sanitizeSearchQuery('test_admin')).toBe('test\\_admin')
    })

    it('\\ 백슬래시 이스케이프', () => {
      expect(sanitizeSearchQuery('test\\path')).toBe('test\\\\path')
    })

    it('복합 와일드카드', () => {
      expect(sanitizeSearchQuery('%_test_%')).toBe('\\%\\_test\\_\\%')
    })

    // SQL injection은 sanitizeSearchQuery가 아닌 Prisma parameterized query로 방어
    it('SQL 패턴은 와일드카드만 이스케이프 (Prisma가 인젝션 방어)', () => {
      const result = sanitizeSearchQuery("' OR 1=1 --")
      // 따옴표, -- 등은 Prisma가 parameterized query로 안전하게 처리
      expect(result).toContain('OR 1=1 --')
    })
  })

  describe('제어문자 제거', () => {
    it('null 바이트 제거', () => {
      expect(sanitizeSearchQuery('hello\0world')).toBe('helloworld')
    })

    it('제어문자 제거', () => {
      expect(sanitizeSearchQuery('test\x01\x02data')).toBe('testdata')
    })

    it('연속 공백 정리', () => {
      expect(sanitizeSearchQuery('hello    world')).toBe('hello world')
    })
  })

  describe('길이 제한', () => {
    it('100자 초과 시 잘림', () => {
      const longInput = 'A'.repeat(200)
      expect(sanitizeSearchQuery(longInput).length).toBe(100)
    })

    it('공백 트림', () => {
      expect(sanitizeSearchQuery('  hello  ')).toBe('hello')
    })

    it('빈 문자열', () => {
      expect(sanitizeSearchQuery('')).toBe('')
    })
  })

  describe('정상 입력 보존', () => {
    it('한글 검색어', () => {
      expect(sanitizeSearchQuery('홍길동')).toBe('홍길동')
    })

    it('영문+숫자', () => {
      expect(sanitizeSearchQuery('item001')).toBe('item001')
    })

    it('하이픈 포함 사번', () => {
      expect(sanitizeSearchQuery('EMP-2024-001')).toBe('EMP-2024-001')
    })

    it('공백 포함 검색어', () => {
      expect(sanitizeSearchQuery('서울시 강남구')).toBe('서울시 강남구')
    })
  })
})

// ─── Rate Limiting 로직 테스트 ───────────────────────
function checkRate(
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const entry = map.get(key)
  if (!entry || entry.resetAt < now) {
    map.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  entry.count += 1
  return entry.count <= limit
}

describe('Rate Limiting', () => {
  it('제한 내 요청 허용', () => {
    const map = new Map()
    for (let i = 0; i < 5; i++) {
      expect(checkRate(map, 'user1', 5, 60000)).toBe(true)
    }
  })

  it('제한 초과 시 거부', () => {
    const map = new Map()
    for (let i = 0; i < 5; i++) {
      checkRate(map, 'user1', 5, 60000)
    }
    expect(checkRate(map, 'user1', 5, 60000)).toBe(false)
  })

  it('다른 사용자는 독립적', () => {
    const map = new Map()
    for (let i = 0; i < 5; i++) {
      checkRate(map, 'user1', 5, 60000)
    }
    expect(checkRate(map, 'user1', 5, 60000)).toBe(false)
    expect(checkRate(map, 'user2', 5, 60000)).toBe(true)
  })

  it('윈도우 만료 후 리셋', () => {
    const map = new Map()
    // 만료된 엔트리 시뮬레이션
    map.set('user1', { count: 10, resetAt: Date.now() - 1000 })
    expect(checkRate(map, 'user1', 5, 60000)).toBe(true)
  })
})

// ─── 페이지네이션 경계값 ─────────────────────────────
function getPaginationParams(params: Record<string, string | null>) {
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(params.pageSize || '20', 10) || 20))
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip }
}

function buildMeta(page: number, pageSize: number, totalCount: number) {
  return {
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  }
}

describe('페이지네이션', () => {
  describe('파라미터 파싱', () => {
    it('기본값', () => {
      expect(getPaginationParams({})).toEqual({ page: 1, pageSize: 20, skip: 0 })
    })

    it('정상 값', () => {
      expect(getPaginationParams({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50, skip: 100 })
    })

    it('page 0 → 1로 클램핑', () => {
      expect(getPaginationParams({ page: '0' }).page).toBe(1)
    })

    it('음수 page → 1로 클램핑', () => {
      expect(getPaginationParams({ page: '-5' }).page).toBe(1)
    })

    it('pageSize 300 → 200으로 클램핑', () => {
      expect(getPaginationParams({ pageSize: '300' }).pageSize).toBe(200)
    })

    it('pageSize 0 → 1로 클램핑', () => {
      expect(getPaginationParams({ pageSize: '0' }).pageSize).toBe(1)
    })

    it('NaN 입력', () => {
      expect(getPaginationParams({ page: 'abc', pageSize: 'xyz' })).toEqual({ page: 1, pageSize: 20, skip: 0 })
    })

    it('소수점 입력', () => {
      const result = getPaginationParams({ page: '2.7', pageSize: '10.5' })
      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(10)
    })
  })

  describe('메타 정보', () => {
    it('기본 메타', () => {
      expect(buildMeta(1, 20, 100)).toEqual({
        page: 1,
        pageSize: 20,
        totalCount: 100,
        totalPages: 5,
      })
    })

    it('나머지 있는 총 페이지수', () => {
      expect(buildMeta(1, 20, 101).totalPages).toBe(6) // 101 / 20 = 5.05 → ceil → 6
    })

    it('데이터 없음', () => {
      expect(buildMeta(1, 20, 0).totalPages).toBe(0)
    })

    it('1개 데이터', () => {
      expect(buildMeta(1, 20, 1).totalPages).toBe(1)
    })
  })
})

// ─── 금액 포맷 ──────────────────────────────────────
function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '₩0'
  return `₩${amount.toLocaleString('ko-KR')}`
}

describe('금액 포맷', () => {
  it('양수', () => {
    expect(formatCurrency(1234567)).toBe('₩1,234,567')
  })

  it('음수', () => {
    expect(formatCurrency(-500)).toBe('₩-500')
  })

  it('0', () => {
    expect(formatCurrency(0)).toBe('₩0')
  })

  it('null → ₩0', () => {
    expect(formatCurrency(null)).toBe('₩0')
  })

  it('undefined → ₩0', () => {
    expect(formatCurrency(undefined)).toBe('₩0')
  })

  it('NaN → ₩0', () => {
    expect(formatCurrency(NaN)).toBe('₩0')
  })

  it('소수점', () => {
    // 한국 로케일에서 소수점 처리
    const result = formatCurrency(1234.56)
    expect(result).toContain('1,234')
  })

  it('대규모 금액 (100억)', () => {
    const result = formatCurrency(10_000_000_000)
    expect(result).toBe('₩10,000,000,000')
  })
})

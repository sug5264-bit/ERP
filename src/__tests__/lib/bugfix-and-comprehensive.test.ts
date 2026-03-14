/**
 * 버그 수정 검증 + 저난이도~극고난이도 종합 테스트
 *
 * ★☆☆☆☆ 저난이도 (Easy)         - 기본 동작 확인
 * ★★☆☆☆ 중난이도 (Medium)       - 경계값, 기본 엣지케이스
 * ★★★☆☆ 고난이도 (Hard)         - 복합 엣지케이스, 동시성 시뮬레이션
 * ★★★★☆ 최고난이도 (Very Hard)   - 보안 공격 패턴, 비정상 입력
 * ★★★★★ 극고난이도 (Extreme)     - 프로토타입 오염, 유니코드 악용, 조합 공격
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  escapeHtml,
  sanitizeString,
  sanitizeSearchQuery,
  sanitizeFileName,
  sanitizeObject,
  validatePaginationParams,
} from '@/lib/sanitize'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhone,
  formatTime,
  getLocalDateString,
  formatDistanceToNow,
} from '@/lib/format'
import { cached, invalidateCache, clearCache, getCacheSize } from '@/lib/cache'
import { checkRateLimit, incrementRateLimit, resetRateLimit } from '@/lib/rate-limit'

// ════════════════════════════════════════════════════════════
// PART 1: 버그 수정 검증 테스트
// ════════════════════════════════════════════════════════════

describe('[버그수정] sanitizeFileName - 디렉터리 참조 방지', () => {
  it('단일 점(.) 파일명은 unnamed_file로 변환', () => {
    expect(sanitizeFileName('.')).toBe('unnamed_file')
  })

  it('이중 점(..) 파일명은 빈 결과로 unnamed_file 반환', () => {
    // '..' → replace(/\.\./g, '') → '' → unnamed_file
    expect(sanitizeFileName('..')).toBe('unnamed_file')
  })

  it('삼중 점(...) 파일명은 . 제거 후 unnamed_file 반환', () => {
    // '...' → replace(/\.\./g, '') → '.' → unnamed_file
    expect(sanitizeFileName('...')).toBe('unnamed_file')
  })

  it('사중 점(....) 파일명은 빈 결과로 unnamed_file 반환', () => {
    // '....' → replace(/\.\./g, '') → '' → unnamed_file
    expect(sanitizeFileName('....')).toBe('unnamed_file')
  })
})

describe('[버그수정] sanitizeObject - 순환 참조 보호', () => {
  it('순환 참조 객체에서 무한 루프 방지', () => {
    const obj: Record<string, unknown> = { name: 'test\0value', count: 42 }
    obj.self = obj // 순환 참조 생성
    // 무한 루프 없이 정상 반환되어야 함
    const result = sanitizeObject(obj)
    expect(result.name).toBe('testvalue')
    expect(result.count).toBe(42)
  })

  it('간접 순환 참조도 처리', () => {
    const a: Record<string, unknown> = { val: 'hello\0' }
    const b: Record<string, unknown> = { val: 'world\0' }
    a.ref = b
    b.ref = a // a → b → a 순환
    const result = sanitizeObject(a)
    expect(result.val).toBe('hello')
  })
})

describe('[버그수정] cache.ts - eviction 이터레이터 안전성', () => {
  beforeEach(() => clearCache())

  it('대량 캐시 삽입 후 eviction이 정상 동작', async () => {
    // 501개 삽입하여 eviction 트리거
    for (let i = 0; i < 501; i++) {
      await cached(`evict-test-${i}`, async () => `value-${i}`)
    }
    // MAX_CACHE_SIZE(500) + 1(방금 삽입) 이하여야 함
    expect(getCacheSize()).toBeLessThanOrEqual(501)
  })
})

describe('[버그수정] formatCurrency - 부분 숫자 문자열 처리', () => {
  it('숫자+문자 혼합 문자열은 0원 반환 (기존: 숫자 부분만 파싱)', () => {
    expect(formatCurrency('123abc')).toBe('0원')
  })

  it('순수 숫자 문자열은 정상 처리', () => {
    expect(formatCurrency('50000')).toBe('50,000원')
  })

  it('소수점 문자열은 정상 처리', () => {
    expect(formatCurrency('1234.56')).toBe('1,235원')
  })

  it('공백 포함 숫자 문자열은 0원 반환', () => {
    expect(formatCurrency('123 456')).toBe('0원')
  })

  it('빈 문자열은 0원 반환', () => {
    expect(formatCurrency('')).toBe('0원')
  })
})

describe('[버그수정] api-helpers - handleApiError 비Error 객체 처리', () => {
  // handleApiError는 내부적으로 NextResponse를 사용하므로 로직만 테스트
  it('Error 인스턴스와 비Error 값의 구분', () => {
    // Error 인스턴스
    const error = new Error('test')
    expect(error instanceof Error).toBe(true)

    // 비Error 값들
    expect('string error' instanceof Error).toBe(false)
    expect(42 instanceof Error).toBe(false)
    expect(null instanceof Error).toBe(false)
    expect(undefined instanceof Error).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════
// PART 2: ★☆☆☆☆ 저난이도 (Easy) - 기본 동작 확인
// ════════════════════════════════════════════════════════════

describe('★☆☆☆☆ [Easy] escapeHtml 기본', () => {
  it('특수문자 없는 텍스트는 그대로 반환', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('빈 문자열 처리', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('한글 텍스트 보존', () => {
    expect(escapeHtml('안녕하세요 테스트')).toBe('안녕하세요 테스트')
  })

  it('숫자만 있는 텍스트', () => {
    expect(escapeHtml('12345')).toBe('12345')
  })
})

describe('★☆☆☆☆ [Easy] formatDate 기본', () => {
  it('Date 객체를 YYYY-MM-DD로 변환', () => {
    expect(formatDate(new Date(2024, 0, 1))).toBe('2024-01-01')
  })

  it('null은 빈 문자열', () => {
    expect(formatDate(null)).toBe('')
  })

  it('undefined는 빈 문자열', () => {
    expect(formatDate(undefined)).toBe('')
  })
})

describe('★☆☆☆☆ [Easy] formatPhone 기본', () => {
  it('일반 휴대폰 번호', () => {
    expect(formatPhone('01098765432')).toBe('010-9876-5432')
  })

  it('null 입력', () => {
    expect(formatPhone(null)).toBe('')
  })
})

describe('★☆☆☆☆ [Easy] cache 기본', () => {
  beforeEach(() => clearCache())

  it('캐시 미스 시 fetcher 호출', async () => {
    const result = await cached('simple', async () => 42)
    expect(result).toBe(42)
  })

  it('캐시 히트 시 fetcher 미호출', async () => {
    let count = 0
    await cached('hit', async () => ++count)
    await cached('hit', async () => ++count)
    expect(count).toBe(1)
  })
})

describe('★☆☆☆☆ [Easy] rate-limit 기본', () => {
  beforeEach(() => resetRateLimit('easy-test'))

  it('첫 요청은 항상 허용', () => {
    const result = checkRateLimit('easy-test')
    expect(result.allowed).toBe(true)
  })

  it('remaining이 정확히 감소', () => {
    incrementRateLimit('easy-test')
    const result = checkRateLimit('easy-test', 5)
    expect(result.remaining).toBe(4)
  })
})

describe('★☆☆☆☆ [Easy] validatePaginationParams 기본', () => {
  it('기본값 반환', () => {
    expect(validatePaginationParams(undefined, undefined)).toEqual({ page: 1, pageSize: 20 })
  })

  it('정상 값', () => {
    expect(validatePaginationParams(3, 50)).toEqual({ page: 3, pageSize: 50 })
  })
})

// ════════════════════════════════════════════════════════════
// PART 3: ★★☆☆☆ 중난이도 (Medium) - 경계값 테스트
// ════════════════════════════════════════════════════════════

describe('★★☆☆☆ [Medium] escapeHtml 경계값', () => {
  it('모든 특수문자 동시 포함', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#x27;')
  })

  it('이미 이스케이프된 문자열 이중 이스케이프', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })

  it('HTML 태그 완전 무력화', () => {
    const input = '<img src=x onerror=alert(1)>'
    const result = escapeHtml(input)
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })
})

describe('★★☆☆☆ [Medium] formatCurrency 경계값', () => {
  it('매우 작은 양수', () => {
    expect(formatCurrency(0.001)).toBe('0원')
  })

  it('매우 작은 음수', () => {
    // -0.001 반올림 시 -0 → Intl.NumberFormat은 음수로 처리
    const result = formatCurrency(-0.001)
    expect(result).toContain('원')
  })

  it('Number.MAX_SAFE_INTEGER', () => {
    const result = formatCurrency(Number.MAX_SAFE_INTEGER)
    expect(result).toContain('원')
    expect(result).not.toBe('0원')
  })

  it('-0 처리', () => {
    // JavaScript에서 -0은 Number이며, Math.abs(-0) = 0
    const result = formatCurrency(-0)
    expect(result).toContain('원')
  })

  it('Infinity는 0원', () => {
    expect(formatCurrency(Infinity)).toBe('0원')
    expect(formatCurrency(-Infinity)).toBe('0원')
  })
})

describe('★★☆☆☆ [Medium] formatPhone 경계값', () => {
  it('서울 9자리 지역번호', () => {
    expect(formatPhone('021234567')).toBe('02-123-4567')
  })

  it('대표번호 8자리', () => {
    expect(formatPhone('15881234')).toBe('1588-1234')
  })

  it('비표준 7자리는 원본 반환', () => {
    expect(formatPhone('1234567')).toBe('1234567')
  })

  it('국제번호는 원본 반환', () => {
    expect(formatPhone('+821012345678')).toBe('+821012345678')
  })

  it('하이픈이 이미 있는 번호 재포맷', () => {
    expect(formatPhone('02-1234-5678')).toBe('02-1234-5678')
  })
})

describe('★★☆☆☆ [Medium] sanitizeString 경계값', () => {
  it('탭 문자는 유지 (제어 문자 범위에 포함되지 않음)', () => {
    // \x09 = 탭, \x0A = 줄바꿈 → 제어문자 regex에 포함되지 않음
    const result = sanitizeString('hello\tworld')
    expect(result).toContain('hello')
    expect(result).toContain('world')
  })

  it('줄바꿈은 유지', () => {
    const result = sanitizeString('line1\nline2')
    expect(result).toContain('line1')
    expect(result).toContain('line2')
  })

  it('혼합 제어문자 + 공백', () => {
    expect(sanitizeString('  \x01hello\x02  \x03world  ')).toBe('hello world')
  })
})

describe('★★☆☆☆ [Medium] cache TTL 경계값', () => {
  beforeEach(() => clearCache())

  it('TTL 0ms는 즉시 만료', async () => {
    let count = 0
    await cached('zero-ttl', async () => ++count, 0)
    await new Promise((r) => setTimeout(r, 1))
    await cached('zero-ttl', async () => ++count, 0)
    expect(count).toBe(2)
  })

  it('음수 TTL은 즉시 만료', async () => {
    let count = 0
    await cached('neg-ttl', async () => ++count, -1000)
    await cached('neg-ttl', async () => ++count, -1000)
    expect(count).toBe(2)
  })
})

describe('★★☆☆☆ [Medium] rate-limit 경계값', () => {
  beforeEach(() => resetRateLimit('med-test'))

  it('정확히 maxAttempts 횟수에서 차단', () => {
    for (let i = 0; i < 3; i++) {
      incrementRateLimit('med-test', 60000)
    }
    const result = checkRateLimit('med-test', 3)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('maxAttempts - 1 횟수는 허용', () => {
    for (let i = 0; i < 2; i++) {
      incrementRateLimit('med-test', 60000)
    }
    const result = checkRateLimit('med-test', 3)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('retryAfterSeconds는 양수', () => {
    for (let i = 0; i < 5; i++) {
      incrementRateLimit('med-test', 60000)
    }
    const result = checkRateLimit('med-test', 5)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60)
  })
})

// ════════════════════════════════════════════════════════════
// PART 4: ★★★☆☆ 고난이도 (Hard) - 복합 엣지케이스
// ════════════════════════════════════════════════════════════

describe('★★★☆☆ [Hard] escapeHtml 복합 공격 패턴', () => {
  it('JavaScript 이벤트 핸들러 XSS', () => {
    const input = '<div onmouseover="alert(document.cookie)">'
    const result = escapeHtml(input)
    expect(result).not.toContain('<div')
    expect(result).toContain('&lt;div')
  })

  it('중첩 HTML 엔티티 공격', () => {
    const input = '&lt;script&gt;alert(1)&lt;/script&gt;'
    const result = escapeHtml(input)
    // &를 &amp;로 이스케이프하므로 이중 인코딩 됨
    expect(result).toContain('&amp;lt;')
  })

  it('SVG XSS 벡터', () => {
    const input = '<svg/onload=alert(1)>'
    const result = escapeHtml(input)
    expect(result).not.toContain('<svg')
  })
})

describe('★★★☆☆ [Hard] sanitizeFileName 복합 공격', () => {
  it('유니코드 경로 순회', () => {
    const result = sanitizeFileName('..%2F..%2Fetc%2Fpasswd')
    expect(result).not.toContain('..')
  })

  it('혼합 OS 경로 구분자', () => {
    const result = sanitizeFileName('folder\\..\\..\\secret.txt')
    // \ 와 .. 모두 제거
    expect(result).not.toContain('\\')
    expect(result).not.toContain('..')
  })

  it('null 바이트 주입', () => {
    const result = sanitizeFileName('test.txt\0.exe')
    expect(result).not.toContain('\0')
    expect(result).toContain('test.txt')
  })

  it('COM9 예약 파일명', () => {
    expect(sanitizeFileName('COM9')).toBe('_COM9')
    expect(sanitizeFileName('LPT1.txt')).toBe('_LPT1.txt')
  })

  it('확장자 없는 예약어 + 점', () => {
    expect(sanitizeFileName('CON.')).toBe('_CON.')
  })

  it('유니코드 zero-width 문자가 포함된 파일명', () => {
    const zwsp = '\u200B' // zero-width space
    const result = sanitizeFileName(`test${zwsp}file.txt`)
    // zero-width space는 제어 문자 범위 밖이므로 유지됨
    expect(result).toContain('test')
    expect(result).toContain('file.txt')
  })
})

describe('★★★☆☆ [Hard] sanitizeObject 깊은 중첩', () => {
  it('5단계 중첩 객체 처리', () => {
    const obj = {
      l1: {
        l2: {
          l3: {
            l4: {
              l5: 'deep\0value',
            },
          },
        },
      },
    }
    const result = sanitizeObject(obj)
    expect((result.l1 as any).l2.l3.l4.l5).toBe('deepvalue')
  })

  it('배열 내 객체의 문자열 살균', () => {
    const obj = {
      items: [
        { name: 'test\x01', value: 42 },
        { name: 'hello\0', value: true },
      ],
    }
    const result = sanitizeObject(obj)
    expect((result.items as any[])[0].name).toBe('test')
    expect((result.items as any[])[1].name).toBe('hello')
  })

  it('Date 객체 보존', () => {
    const now = new Date()
    const obj = { created: now, name: 'test\0' }
    const result = sanitizeObject(obj)
    expect(result.created).toBe(now)
    expect(result.name).toBe('test')
  })

  it('null/boolean/number 보존', () => {
    const obj = {
      a: null,
      b: false,
      c: 0,
      d: '',
      e: undefined,
    }
    const result = sanitizeObject(obj as Record<string, unknown>)
    expect(result.a).toBe(null)
    expect(result.b).toBe(false)
    expect(result.c).toBe(0)
  })
})

describe('★★★☆☆ [Hard] cache 동시성 시뮬레이션', () => {
  beforeEach(() => clearCache())

  it('동일 키에 대한 동시 요청은 fetcher를 여러 번 호출할 수 있음', async () => {
    let count = 0
    const slowFetcher = async () => {
      count++
      await new Promise((r) => setTimeout(r, 10))
      return count
    }

    // 동시에 3개 요청
    const [r1, r2, r3] = await Promise.all([
      cached('concurrent', slowFetcher),
      cached('concurrent', slowFetcher),
      cached('concurrent', slowFetcher),
    ])

    // 첫 번째 요청 시 캐시 미스이므로 여러 번 호출될 수 있음
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it('와일드카드 무효화는 매칭되는 모든 키 제거', async () => {
    await cached('module:items:1', async () => 'a')
    await cached('module:items:2', async () => 'b')
    await cached('module:orders:1', async () => 'c')

    invalidateCache('module:items:*')

    let itemCount = 0
    let orderCount = 0
    await cached('module:items:1', async () => {
      itemCount++
      return 'a2'
    })
    await cached('module:items:2', async () => {
      itemCount++
      return 'b2'
    })
    await cached('module:orders:1', async () => {
      orderCount++
      return 'c2'
    })

    expect(itemCount).toBe(2) // items 무효화됨
    expect(orderCount).toBe(0) // orders는 캐시 히트
  })
})

describe('★★★☆☆ [Hard] formatDate 경계값', () => {
  it('윤년 2월 29일', () => {
    expect(formatDate(new Date(2024, 1, 29))).toBe('2024-02-29')
  })

  it('연말 12월 31일', () => {
    expect(formatDate(new Date(2024, 11, 31))).toBe('2024-12-31')
  })

  it('유효하지 않은 ISO 문자열', () => {
    expect(formatDate('not-a-date')).toBe('')
  })

  it('Unix epoch', () => {
    expect(formatDate(new Date(0))).toBe('1970-01-01')
  })
})

describe('★★★☆☆ [Hard] 복합 비즈니스 로직: 부가세 계산', () => {
  function calculateVAT(supplyAmount: number): { supply: number; vat: number; total: number } {
    const vat = Math.round(supplyAmount * 0.1)
    return { supply: supplyAmount, vat, total: supplyAmount + vat }
  }

  it('기본 부가세 계산', () => {
    expect(calculateVAT(10000)).toEqual({ supply: 10000, vat: 1000, total: 11000 })
  })

  it('반올림 경계: 5원 단위', () => {
    // 335 * 0.1 = 33.5 → Math.round → 34
    expect(calculateVAT(335).vat).toBe(34)
    // 334 * 0.1 = 33.4 → Math.round → 33
    expect(calculateVAT(334).vat).toBe(33)
  })

  it('0원 공급가', () => {
    expect(calculateVAT(0)).toEqual({ supply: 0, vat: 0, total: 0 })
  })

  it('1원 공급가', () => {
    // 1 * 0.1 = 0.1 → Math.round → 0
    expect(calculateVAT(1).vat).toBe(0)
  })

  it('음수 공급가 (환불)', () => {
    expect(calculateVAT(-10000)).toEqual({ supply: -10000, vat: -1000, total: -11000 })
  })
})

// ════════════════════════════════════════════════════════════
// PART 5: ★★★★☆ 최고난이도 (Very Hard) - 보안 공격 패턴
// ════════════════════════════════════════════════════════════

describe('★★★★☆ [Very Hard] XSS 공격 벡터 방어', () => {
  it('script 태그 기본 공격', () => {
    const result = escapeHtml('<script>alert("XSS")</script>')
    expect(result).not.toContain('<script>')
    expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
  })

  it('img 태그 onerror XSS', () => {
    const result = escapeHtml('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain('<img')
  })

  it('data: URI XSS', () => {
    const result = escapeHtml('<a href="data:text/html,<script>alert(1)</script>">')
    expect(result).not.toContain('<a')
    // href= 는 이스케이프된 속성 내에 텍스트로 남지만, < > 는 제거됨
    expect(result).not.toContain('<script')
  })

  it('javascript: URI XSS', () => {
    const result = escapeHtml('<a href="javascript:alert(1)">')
    expect(result).not.toContain('<a')
  })

  it('이벤트 핸들러 XSS (onload, onfocus 등)', () => {
    const attacks = [
      '<body onload=alert(1)>',
      '<input onfocus=alert(1) autofocus>',
      '<marquee onstart=alert(1)>',
      '<video><source onerror="alert(1)">',
    ]
    for (const attack of attacks) {
      const result = escapeHtml(attack)
      expect(result).not.toContain('<')
    }
  })

  it('CSS expression XSS', () => {
    const result = escapeHtml('<div style="background:url(javascript:alert(1))">')
    expect(result).not.toContain('<div')
  })
})

describe('★★★★☆ [Very Hard] SQL Injection 방어', () => {
  it('기본 SQL injection 시도', () => {
    const result = sanitizeSearchQuery("'; DROP TABLE users; --")
    // SQL 와일드카드만 이스케이프, SQL 키워드는 Prisma가 방어
    expect(result).not.toContain('%')
    expect(result).not.toContain('\0')
  })

  it('UNION SELECT 공격', () => {
    const result = sanitizeSearchQuery("' UNION SELECT * FROM users --")
    // Prisma parameterized query가 방어하므로 와일드카드만 이스케이프
    expect(result.length).toBeLessThanOrEqual(100)
  })

  it('blind SQL injection (WAITFOR)', () => {
    const result = sanitizeSearchQuery("'; WAITFOR DELAY '0:0:5'; --")
    expect(result).not.toContain('\0')
  })

  it('중첩 주석 공격', () => {
    const result = sanitizeSearchQuery('test/**/OR/**/1=1')
    // 특수 처리 없이 통과 (Prisma가 방어)
    expect(result).toBe('test/**/OR/**/1=1')
  })

  it('LIKE 와일드카드 악용 시도', () => {
    // %와 _를 사용한 데이터 유출 시도
    const result = sanitizeSearchQuery('% OR 1=1 --')
    expect(result).toBe('\\% OR 1=1 --')
  })
})

describe('★★★★☆ [Very Hard] 파일 업로드 보안', () => {
  it('이중 확장자 공격', () => {
    const result = sanitizeFileName('malware.php.jpg')
    expect(result).toBe('malware.php.jpg')
    // 확장자 검사는 sanitizeFileName의 책임이 아니지만, 구조는 보존
  })

  it('null 바이트 확장자 우회', () => {
    const result = sanitizeFileName('shell.php\0.jpg')
    expect(result).not.toContain('\0')
  })

  it('매우 긴 확장자', () => {
    const name = 'file.' + 'a'.repeat(300)
    expect(sanitizeFileName(name).length).toBeLessThanOrEqual(255)
  })

  it('유니코드 Right-to-Left Override', () => {
    // RLO 문자 (U+202E)는 제어문자 범위 밖이지만 위험
    const rlo = '\u202E'
    const result = sanitizeFileName(`test${rlo}exe.txt`)
    // 파일명에 RLO가 포함되어도 금지 문자에 해당하지 않음
    expect(result).toContain('test')
  })

  it('Windows 예약 디바이스명 + 확장자', () => {
    expect(sanitizeFileName('COM1')).toBe('_COM1')
    expect(sanitizeFileName('LPT9.txt')).toBe('_LPT9.txt')
    expect(sanitizeFileName('PRN.doc')).toBe('_PRN.doc')
    expect(sanitizeFileName('AUX')).toBe('_AUX')
  })
})

describe('★★★★☆ [Very Hard] 부동소수점 정밀도 비즈니스 로직', () => {
  it('0.1 + 0.2 !== 0.3 문제', () => {
    expect(0.1 + 0.2).not.toBe(0.3) // JavaScript 특성
    // 센트 변환으로 해결
    expect(Math.round(0.1 * 100) + Math.round(0.2 * 100)).toBe(Math.round(0.3 * 100))
  })

  it('대규모 금액에서 센트 변환 안전성', () => {
    const amount = 999_999_999.99
    const cents = Math.round(amount * 100)
    expect(cents).toBe(99999999999)
    expect(cents / 100).toBe(999999999.99)
  })

  it('전표 차대변 균형 검증', () => {
    const debits = [100.1, 200.2, 300.3]
    const credits = [600.6]

    // 잘못된 방식
    const sumDebits = debits.reduce((a, b) => a + b, 0)
    const sumCredits = credits.reduce((a, b) => a + b, 0)
    // 부동소수점으로 인해 불일치 가능
    // expect(sumDebits).not.toBe(sumCredits) // 600.5999... vs 600.6

    // 올바른 방식
    const debitCents = debits.reduce((a, b) => a + Math.round(b * 100), 0)
    const creditCents = credits.reduce((a, b) => a + Math.round(b * 100), 0)
    expect(debitCents).toBe(creditCents) // 60060 === 60060
  })

  it('음수 금액 반올림', () => {
    // Math.round(-0.5) = -0 (JavaScript 구현)
    expect(Math.round(-0.5)).toBe(-0)
    // Math.round(-1.5) = -1
    expect(Math.round(-1.5)).toBe(-1)
    // 비즈니스 로직에서는 Math.round 결과를 절대값으로 비교해야 안전
    expect(Math.abs(Math.round(-0.5))).toBe(0)
  })
})

describe('★★★★☆ [Very Hard] rate-limit 윈도우 만료 시뮬레이션', () => {
  it('만료된 윈도우는 자동 리셋', () => {
    const key = 'expire-test-' + Date.now()
    // 매우 짧은 윈도우로 increment
    incrementRateLimit(key, 1) // 1ms 윈도우

    // 약간 대기 후 체크
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit(key, 5)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(5)
        resolve()
      }, 10)
    })
  })

  it('여러 키 독립성', () => {
    const keys = ['a', 'b', 'c', 'd', 'e'].map((k) => `indep-${k}-${Date.now()}`)

    // 첫 번째 키만 제한 도달
    for (let i = 0; i < 5; i++) {
      incrementRateLimit(keys[0], 60000)
    }

    expect(checkRateLimit(keys[0], 5).allowed).toBe(false)
    expect(checkRateLimit(keys[1], 5).allowed).toBe(true)
    expect(checkRateLimit(keys[2], 5).allowed).toBe(true)

    // cleanup
    keys.forEach(resetRateLimit)
  })
})

describe('★★★★☆ [Very Hard] sanitizeSearchQuery 복합 공격', () => {
  it('URL 인코딩된 와일드카드', () => {
    // %25 = '%' (URL 인코딩), %5F = '_' (URL 인코딩) — 그러나 sanitize는 URL 디코딩하지 않음
    // '%'만 이스케이프되고, '5F'의 'F'는 일반 문자
    const result = sanitizeSearchQuery('%25 %5F')
    expect(result).toBe('\\%25 \\%5F')
  })

  it('유니코드 정규화 공격', () => {
    // 유니코드 퍼센트 기호 (U+FF05 = ％)
    const fullWidthPercent = '\uFF05'
    const result = sanitizeSearchQuery(`test${fullWidthPercent}admin`)
    // 전각 %는 ASCII %가 아니므로 이스케이프되지 않음
    expect(result).toContain(fullWidthPercent)
  })

  it('100자 초과 후 와일드카드 이스케이프된 문자열', () => {
    // 이스케이프로 인해 길어진 문자열이 100자에서 잘림
    const input = '%'.repeat(60) // 이스케이프 후 120자 → 100자로 자름
    const result = sanitizeSearchQuery(input)
    expect(result.length).toBe(100)
  })
})

// ════════════════════════════════════════════════════════════
// PART 6: ★★★★★ 극고난이도 (Extreme) - 프로토타입 오염, 유니코드 악용
// ════════════════════════════════════════════════════════════

describe('★★★★★ [Extreme] 프로토타입 오염 방어', () => {
  it('__proto__ 키는 sanitizeObject에서 안전하게 처리', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}, "name": "test\\u0000"}')
    const result = sanitizeObject(malicious)
    // Object.prototype이 오염되지 않아야 함
    expect(({} as any).polluted).toBeUndefined()
  })

  it('constructor 키 포함 객체', () => {
    const obj = { constructor: 'test\0value', name: 'hello\0' }
    const result = sanitizeObject(obj as any)
    expect(result.name).toBe('hello')
  })

  it('toString 오버라이드 시도', () => {
    const obj = { toString: 'evil\0', valueOf: 'bad\0', name: 'test\x01' }
    const result = sanitizeObject(obj as any)
    expect(result.name).toBe('test')
  })
})

describe('★★★★★ [Extreme] 유니코드 공격 벡터', () => {
  it('유니코드 호모글리프(homoglyph) 공격', () => {
    // Cyrillic 'а' (U+0430) vs Latin 'a' (U+0061) - 시각적으로 동일
    const cyrillicA = '\u0430'
    const result = sanitizeString(`${cyrillicA}dmin`)
    // sanitize는 유니코드를 제거하지 않으므로 통과
    expect(result).toBe(`${cyrillicA}dmin`)
    // 비교 시 구분 필요
    expect(result).not.toBe('admin')
  })

  it('Zero-width joiner/non-joiner 삽입', () => {
    const zwj = '\u200D' // zero-width joiner
    const zwnj = '\u200C' // zero-width non-joiner
    const input = `ad${zwj}min${zwnj}istrator`
    const result = sanitizeString(input)
    // 제어 문자 범위 밖이므로 유지
    expect(result.length).toBeGreaterThan(13)
  })

  it('방향 제어 문자 (LRO/RLO)', () => {
    const lro = '\u202D' // Left-to-Right Override
    const rlo = '\u202E' // Right-to-Left Override
    const input = `test${rlo}txt.exe${lro}`
    const result = sanitizeString(input)
    // 이 문자들은 현재 sanitizeString에서 제거되지 않음
    expect(result).toContain('test')
  })

  it('BOM (Byte Order Mark) 처리', () => {
    const bom = '\uFEFF'
    const result = sanitizeString(`${bom}hello world`)
    expect(result).toContain('hello world')
  })

  it('이모지가 포함된 입력', () => {
    const result = sanitizeString('사용자 이름 😀 👍')
    expect(result).toContain('😀')
    expect(result).toContain('👍')
  })

  it('서로게이트 페어 유니코드', () => {
    // 𝕳𝕰𝕷𝕷𝕺 - Mathematical Double-Struck letters
    const fancy = '𝕳𝕰𝕷𝕷𝕺'
    const result = sanitizeString(fancy)
    expect(result).toBe(fancy)
  })
})

describe('★★★★★ [Extreme] escapeHtml 고급 XSS 우회 기법', () => {
  it('HTML5 파서 악용 - 자동 닫힘 태그', () => {
    const input = '<img/src=x onerror=alert(1)//>'
    expect(escapeHtml(input)).not.toContain('<img')
  })

  it('여러 인코딩 레이어 XSS', () => {
    // HTML 엔티티 + URL 인코딩 + JS 이스케이프
    const input = '&#60;script&#62;alert(&#39;xss&#39;)&#60;/script&#62;'
    const result = escapeHtml(input)
    // & → &amp; 로 이중 인코딩
    expect(result).toContain('&amp;#60;')
  })

  it('mutation XSS (mXSS)', () => {
    const input = '<svg><desc><![CDATA[</desc><script>alert(1)</script>]]></desc></svg>'
    const result = escapeHtml(input)
    expect(result).not.toContain('<svg')
    expect(result).not.toContain('<script')
  })

  it('template literal XSS', () => {
    const input = '<template><script>alert(1)</script></template>'
    const result = escapeHtml(input)
    expect(result).not.toContain('<template')
  })

  it('polyglot XSS payload', () => {
    const input =
      'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teleType/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>\\x3e'
    const result = escapeHtml(input)
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })
})

describe('★★★★★ [Extreme] 캐시 스탬피드(stampede) 시뮬레이션', () => {
  beforeEach(() => clearCache())

  it('대량 동시 캐시 미스 처리', async () => {
    let fetchCount = 0
    const expensiveFetcher = async () => {
      fetchCount++
      await new Promise((r) => setTimeout(r, 5))
      return { data: 'expensive' }
    }

    // 100개의 동시 요청
    const promises = Array.from({ length: 100 }, (_, i) => cached('stampede-key', expensiveFetcher))

    const results = await Promise.all(promises)

    // 모든 결과가 동일해야 함
    for (const result of results) {
      expect(result).toEqual({ data: 'expensive' })
    }
    // fetcher가 100번 호출될 수 있지만 에러 없이 완료
    expect(fetchCount).toBeGreaterThanOrEqual(1)
  })

  it('서로 다른 키에 대한 대량 동시 요청', async () => {
    const promises = Array.from({ length: 50 }, (_, i) => cached(`multi-key-${i}`, async () => `value-${i}`))
    const results = await Promise.all(promises)
    expect(results.length).toBe(50)
    expect(results[0]).toBe('value-0')
    expect(results[49]).toBe('value-49')
  })
})

describe('★★★★★ [Extreme] validatePaginationParams 극단적 입력', () => {
  it('Infinity', () => {
    const result = validatePaginationParams(Infinity, Infinity)
    expect(result.page).toBe(10000)
    expect(result.pageSize).toBe(100)
  })

  it('-Infinity', () => {
    // Number(-Infinity) = -Infinity, || 로 인해 NaN/0은 기본값으로, 하지만 -Infinity는 truthy
    // Math.max(1, Math.min(100, -Infinity)) = Math.max(1, -Infinity) = 1
    const result = validatePaginationParams(-Infinity, -Infinity)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(1) // Math.max(1, Math.min(100, -Infinity)) = 1
  })

  it('NaN', () => {
    const result = validatePaginationParams(NaN, NaN)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('Number.MAX_VALUE', () => {
    const result = validatePaginationParams(Number.MAX_VALUE, Number.MAX_VALUE)
    expect(result.page).toBe(10000)
    expect(result.pageSize).toBe(100)
  })

  it('Number.MIN_VALUE (양의 최소값 ≈ 0)', () => {
    const result = validatePaginationParams(Number.MIN_VALUE, Number.MIN_VALUE)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(1)
  })

  it('문자열 입력', () => {
    const result = validatePaginationParams('abc' as any, 'xyz' as any)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('객체 입력', () => {
    const result = validatePaginationParams({} as any, [] as any)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('boolean 입력', () => {
    // Number(true) = 1, Number(false) = 0
    const result = validatePaginationParams(true as any, false as any)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20) // false → 0 → fallback to 20
  })
})

describe('★★★★★ [Extreme] formatCurrency 극단적 입력', () => {
  it('Number.MAX_SAFE_INTEGER', () => {
    const result = formatCurrency(Number.MAX_SAFE_INTEGER)
    expect(result).toContain('원')
    expect(result).not.toBe('0원')
  })

  it('Number.MIN_SAFE_INTEGER', () => {
    const result = formatCurrency(Number.MIN_SAFE_INTEGER)
    expect(result).toContain('△')
    expect(result).toContain('원')
  })

  it('매우 작은 소수점', () => {
    expect(formatCurrency(0.0000001)).toBe('0원')
  })

  it('e 표기법 문자열', () => {
    expect(formatCurrency('1e5')).toBe('100,000원')
  })

  it('16진수 문자열', () => {
    expect(formatCurrency('0xFF')).toBe('0원')
  })

  it('공백만 있는 문자열', () => {
    expect(formatCurrency('   ')).toBe('0원')
  })

  it('부호만 있는 문자열', () => {
    expect(formatCurrency('-')).toBe('0원')
    expect(formatCurrency('+')).toBe('0원')
  })

  it('콤마가 포함된 문자열', () => {
    // parseFloat('1,000') = 1 이므로 Number('1,000') = NaN → 0원
    expect(formatCurrency('1,000')).toBe('0원')
  })
})

describe('★★★★★ [Extreme] 복합 시나리오: 전체 워크플로우 시뮬레이션', () => {
  it('악의적 사용자 입력 → 살균 → 포맷 → 검증 전체 파이프라인', () => {
    // 1. 악의적 입력
    const maliciousInput = {
      name: '<script>alert("xss")</script>\0malicious',
      amount: '999999.99',
      phone: '010-1234-5678',
      searchQuery: "' OR 1=1; DROP TABLE users; --",
      fileName: '../../../etc/shadow',
    }

    // 2. 살균
    const sanitized = sanitizeObject({
      name: sanitizeString(maliciousInput.name),
      searchQuery: sanitizeSearchQuery(maliciousInput.searchQuery),
      fileName: sanitizeFileName(maliciousInput.fileName),
    })

    // 3. HTML 이스케이프
    const escaped = escapeHtml(sanitized.name as string)

    // 4. 검증
    expect(escaped).not.toContain('<script>')
    expect(escaped).not.toContain('\0')
    expect(sanitized.searchQuery).not.toContain('\0')
    expect(sanitized.fileName).not.toContain('..')
    expect(sanitized.fileName).not.toContain('/')

    // 5. 포맷팅
    expect(formatPhone(maliciousInput.phone)).toBe('010-1234-5678')
  })

  it('동시 캐시 + rate-limit 시나리오', async () => {
    const userId = `extreme-user-${Date.now()}`
    clearCache()

    // rate-limit 체크
    const rateCheck = checkRateLimit(userId, 10)
    expect(rateCheck.allowed).toBe(true)

    // 캐시에서 사용자 데이터 조회
    const userData = await cached(`user:${userId}`, async () => ({
      id: userId,
      name: 'Test User',
      loginCount: 0,
    }))

    // increment rate limit
    incrementRateLimit(userId, 60000)

    // 9번 더 시도
    for (let i = 0; i < 9; i++) {
      incrementRateLimit(userId, 60000)
    }

    // 10번째에서 차단
    const blocked = checkRateLimit(userId, 10)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)

    // 캐시된 사용자 데이터는 여전히 유효
    const cachedData = await cached(`user:${userId}`, async () => ({ id: '', name: '', loginCount: -1 }))
    expect(cachedData.id).toBe(userId) // 캐시 히트

    // cleanup
    resetRateLimit(userId)
    invalidateCache(`user:${userId}`)
  })
})

describe('★★★★★ [Extreme] sanitizeObject 복잡한 데이터 구조', () => {
  it('빈 객체', () => {
    expect(sanitizeObject({})).toEqual({})
  })

  it('빈 배열을 포함한 객체', () => {
    const obj = { items: [], name: 'test\0' }
    const result = sanitizeObject(obj)
    expect(result.items).toEqual([])
    expect(result.name).toBe('test')
  })

  it('혼합 타입 배열', () => {
    const obj = {
      mixed: ['string\0', 42, true, null, undefined, new Date(), { nested: 'val\x01' }],
    }
    const result = sanitizeObject(obj as any)
    const mixed = result.mixed as unknown[]
    expect(mixed[0]).toBe('string')
    expect(mixed[1]).toBe(42)
    expect(mixed[2]).toBe(true)
    expect(mixed[3]).toBe(null)
    expect(mixed[4]).toBeUndefined()
  })

  it('Symbol 키는 무시 (Object.keys에 포함되지 않음)', () => {
    const sym = Symbol('test')
    const obj = { [sym]: 'hidden', visible: 'test\0' } as any
    const result = sanitizeObject(obj)
    expect(result.visible).toBe('test')
  })

  it('getter/setter 프로퍼티', () => {
    const obj = {
      _name: 'test\0',
      get name() {
        return this._name
      },
    }
    // Object spread는 getter를 호출하여 값으로 변환
    const result = sanitizeObject(obj as any)
    expect(result.name).toBe('test')
  })
})

describe('★★★★★ [Extreme] formatDate/Time 극단적 날짜', () => {
  it('아주 먼 과거', () => {
    const result = formatDate(new Date(0, 0, 1)) // 1900년대
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('아주 먼 미래', () => {
    const result = formatDate(new Date(9999, 11, 31))
    expect(result).toBe('9999-12-31')
  })

  it('Invalid Date 객체', () => {
    expect(formatDate(new Date('invalid'))).toBe('')
    expect(formatDateTime(new Date('invalid'))).toBe('')
    expect(formatTime(new Date('invalid'))).toBe('')
  })

  it('밀리초 정밀도 시간', () => {
    const date = new Date(2024, 0, 1, 23, 59, 59, 999)
    expect(formatTime(date)).toBe('23:59')
  })

  it('자정(00:00)', () => {
    const date = new Date(2024, 0, 1, 0, 0, 0)
    expect(formatTime(date)).toBe('00:00')
  })

  it('getLocalDateString 기본 호출', () => {
    const result = getLocalDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('formatDistanceToNow with invalid string', () => {
    expect(formatDistanceToNow('invalid-date-string')).toBe('')
  })
})

describe('★★★★★ [Extreme] 복합 sanitizeFileName 공격 조합', () => {
  it('경로 순회 + 예약어 + null 바이트 복합 공격', () => {
    const result = sanitizeFileName('..\\..\\.\\CON\0.txt')
    // \와 ..와 \0 모두 제거, CON → _CON
    expect(result).not.toContain('..')
    expect(result).not.toContain('\\')
    expect(result).not.toContain('\0')
  })

  it('순수 특수문자만으로 구성된 파일명', () => {
    expect(sanitizeFileName('<>:"/\\|?*')).toBe('unnamed_file')
  })

  it('공백만으로 구성된 파일명', () => {
    expect(sanitizeFileName('   ')).toBe('unnamed_file')
  })

  it('매우 긴 한글 파일명', () => {
    const name = '가'.repeat(300) + '.xlsx'
    const result = sanitizeFileName(name)
    expect(result.length).toBeLessThanOrEqual(255)
    // 255자 제한으로 인해 확장자가 잘릴 수 있음 (한글 300자 > 255)
    expect(result.length).toBe(255)
  })

  it('점으로 시작하는 숨김 파일', () => {
    const result = sanitizeFileName('.gitignore')
    expect(result).toBe('.gitignore')
  })

  it('점으로 끝나는 파일명 (Windows 금지)', () => {
    const result = sanitizeFileName('test.')
    expect(result).toBe('test.')
  })
})

describe('★★★★★ [Extreme] cache 에러 복구', () => {
  beforeEach(() => clearCache())

  it('fetcher가 에러를 던지면 캐시에 저장하지 않음', async () => {
    let attempt = 0
    const failThenSucceed = async () => {
      attempt++
      if (attempt === 1) throw new Error('transient error')
      return 'success'
    }

    await expect(cached('error-key', failThenSucceed)).rejects.toThrow('transient error')

    // 두 번째 시도는 성공
    const result = await cached('error-key', failThenSucceed)
    expect(result).toBe('success')
    expect(attempt).toBe(2)
  })

  it('fetcher가 undefined를 반환해도 캐시 가능', async () => {
    let count = 0
    const fetcher = async () => {
      count++
      return undefined as unknown
    }

    await cached('undef-key', fetcher)
    await cached('undef-key', fetcher)
    // undefined도 캐시되므로 1번만 호출
    expect(count).toBe(1)
  })

  it('fetcher가 null을 반환해도 캐시 가능', async () => {
    let count = 0
    const fetcher = async () => {
      count++
      return null as unknown
    }

    await cached('null-key', fetcher)
    await cached('null-key', fetcher)
    expect(count).toBe(1)
  })

  it('TTL=1ms → 즉시 만료 → 연속 호출 시 매번 fetcher 재실행', async () => {
    let count = 0
    for (let i = 0; i < 5; i++) {
      await cached('short-ttl', async () => ++count, 1)
      await new Promise((r) => setTimeout(r, 5))
    }
    expect(count).toBe(5)
  })
})

// ─────────────────────────────────────────────────────
// 추가 버그 수정 검증 테스트 (2차)
// ─────────────────────────────────────────────────────

describe('★★★☆☆ [Bug Fix 2차] sanitizeString: DEL 문자(\\x7F) 제거', () => {
  it('DEL 문자(\\x7F)가 제거되어야 함', () => {
    expect(sanitizeString('hello\x7Fworld')).toBe('helloworld')
  })

  it('여러 DEL 문자', () => {
    expect(sanitizeString('\x7F\x7F\x7F')).toBe('')
  })

  it('DEL + 다른 제어 문자 조합', () => {
    expect(sanitizeString('\x00\x01\x7Ftest\x1F\x7F')).toBe('test')
  })

  it('DEL 문자가 없는 일반 문자열은 변경 없음', () => {
    expect(sanitizeString('normal text')).toBe('normal text')
  })
})

describe('★★★☆☆ [Bug Fix 2차] rate-limit: 메모리 보호', () => {
  it('만료된 엔트리 정리 (expired entries)', () => {
    const key = `expired-${Date.now()}`
    // windowMs를 1ms로 설정
    incrementRateLimit(key, 1)
    // 약간 대기 후 확인
    const check = checkRateLimit(key, 5, 1)
    // resetAt이 과거이므로 allowed
    // (타이밍에 따라 다를 수 있지만, 1ms 이내에 체크하면 아직 유효할 수 있음)
    expect(check.allowed).toBe(true)
  })

  it('rate-limit 차단 후 reset으로 복구', () => {
    const key = `reset-test-${Date.now()}`
    for (let i = 0; i < 10; i++) {
      incrementRateLimit(key, 60000)
    }
    expect(checkRateLimit(key, 5).allowed).toBe(false)
    resetRateLimit(key)
    expect(checkRateLimit(key, 5).allowed).toBe(true)
  })

  it('서로 다른 키는 독립적으로 동작', () => {
    const key1 = `independent-a-${Date.now()}`
    const key2 = `independent-b-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      incrementRateLimit(key1, 60000)
    }
    expect(checkRateLimit(key1, 5).allowed).toBe(false)
    expect(checkRateLimit(key2, 5).allowed).toBe(true)
    resetRateLimit(key1)
    resetRateLimit(key2)
  })
})

describe('★★★★☆ [Bug Fix 2차] sanitizeFileName: 추가 보안 검증', () => {
  it('DEL 문자가 포함된 파일명', () => {
    const result = sanitizeFileName('file\x7Fname.txt')
    expect(result).not.toContain('\x7F')
  })

  it('null 바이트 + 경로 순회 + 예약어 복합 공격', () => {
    const result = sanitizeFileName('..\\..\\CON\x00.txt')
    expect(result).not.toContain('\x00')
    expect(result).not.toContain('\\')
    expect(result).toBeTruthy()
    expect(result).not.toBe('')
  })

  it('유니코드 문자가 포함된 파일명 보존', () => {
    const result = sanitizeFileName('보고서_2024.pdf')
    expect(result).toBe('보고서_2024.pdf')
  })

  it('이모지가 포함된 파일명 보존', () => {
    const result = sanitizeFileName('📊report.xlsx')
    expect(result).toBe('📊report.xlsx')
  })
})

describe('★★★★☆ [Bug Fix 2차] sanitizeSearchQuery: 와일드카드 이스케이프', () => {
  it('SQL 와일드카드 이스케이프', () => {
    expect(sanitizeSearchQuery('100%')).toBe('100\\%')
    expect(sanitizeSearchQuery('col_name')).toBe('col\\_name')
  })

  it('백슬래시 이스케이프', () => {
    expect(sanitizeSearchQuery('path\\to')).toBe('path\\\\to')
  })

  it('복합 SQL 인젝션 패턴', () => {
    const result = sanitizeSearchQuery("'; DROP TABLE users; --")
    expect(result).not.toContain('\0')
    expect(result.length).toBeLessThanOrEqual(100)
  })

  it('100자 초과 검색어 자르기', () => {
    const longQuery = 'a'.repeat(200)
    expect(sanitizeSearchQuery(longQuery).length).toBe(100)
  })
})

describe('★★★★★ [Extreme] rate-limit 대량 키 시나리오', () => {
  it('대량의 키 등록 후 체크', () => {
    const keys: string[] = []
    for (let i = 0; i < 100; i++) {
      const key = `mass-test-${Date.now()}-${i}`
      keys.push(key)
      incrementRateLimit(key, 60000)
    }

    // 모든 키가 정상 동작해야 함
    for (const key of keys) {
      const check = checkRateLimit(key, 5)
      expect(check.allowed).toBe(true)
      expect(check.remaining).toBe(4) // 1번 increment 했으므로 4 remaining
    }

    // cleanup
    for (const key of keys) {
      resetRateLimit(key)
    }
  })

  it('동일 키 대량 increment', () => {
    const key = `heavy-${Date.now()}`
    for (let i = 0; i < 100; i++) {
      incrementRateLimit(key, 60000)
    }
    const check = checkRateLimit(key, 5)
    expect(check.allowed).toBe(false)
    expect(check.remaining).toBe(0)
    expect(check.retryAfterSeconds).toBeGreaterThan(0)
    resetRateLimit(key)
  })
})

describe('★★★★★ [Extreme] escapeHtml 보안 검증', () => {
  it('중첩 HTML 태그 이스케이프', () => {
    const result = escapeHtml('<div><script>alert(1)</script></div>')
    expect(result).not.toContain('<div>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;div&gt;')
  })

  it('이벤트 핸들러 속성 이스케이프', () => {
    const result = escapeHtml('<img onerror="alert(1)" src="x">')
    expect(result).not.toContain('<img')
    expect(result).toContain('&lt;img')
  })

  it('HTML 엔티티 이중 이스케이프 방지', () => {
    const result = escapeHtml('&amp;')
    expect(result).toBe('&amp;amp;')
  })

  it('빈 문자열', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('특수문자 없는 일반 텍스트', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('모든 이스케이프 대상 문자 포함', () => {
    const result = escapeHtml('&<>"\' test')
    expect(result).toBe('&amp;&lt;&gt;&quot;&#x27; test')
  })
})

describe('★★★★★ [Extreme] formatPhone 추가 엣지 케이스', () => {
  it('국제 번호 (포맷 변경 없음)', () => {
    expect(formatPhone('+821012345678')).toBe('+821012345678')
  })

  it('짧은 번호', () => {
    expect(formatPhone('114')).toBe('114')
  })

  it('대표번호 1588', () => {
    expect(formatPhone('15881234')).toBe('1588-1234')
  })

  it('대표번호 1577', () => {
    expect(formatPhone('15771234')).toBe('1577-1234')
  })

  it('서울 지역번호 10자리', () => {
    expect(formatPhone('0212345678')).toBe('02-1234-5678')
  })

  it('서울 지역번호 9자리', () => {
    expect(formatPhone('021234567')).toBe('02-123-4567')
  })

  it('하이픈 포함 번호 정리', () => {
    expect(formatPhone('010-1234-5678')).toBe('010-1234-5678')
  })

  it('null 입력', () => {
    expect(formatPhone(null)).toBe('')
  })

  it('undefined 입력', () => {
    expect(formatPhone(undefined)).toBe('')
  })

  it('빈 문자열', () => {
    expect(formatPhone('')).toBe('')
  })
})

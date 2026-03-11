/**
 * 난이도: 어려움 (Hard)
 * 미들웨어 핵심 로직 테스트: IP 추출, Rate Limiting, Request ID
 * 실제 middleware.ts의 순수 함수 로직을 복제하여 단위 테스트
 */
import { describe, it, expect, beforeEach } from 'vitest'

// ─── IP 추출 로직 (middleware.ts에서 추출) ───

const IP_PATTERN = /^[\d.a-fA-F:]+$/

function getIp(headers: Map<string, string>): string {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp && IP_PATTERN.test(realIp)) return realIp

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim()
    if (firstIp && IP_PATTERN.test(firstIp)) return firstIp
  }

  return 'unknown'
}

describe('IP 추출 로직', () => {
  it('x-real-ip 우선 사용', () => {
    const headers = new Map([
      ['x-real-ip', '10.0.0.1'],
      ['x-forwarded-for', '192.168.1.1'],
    ])
    expect(getIp(headers)).toBe('10.0.0.1')
  })

  it('x-real-ip 없으면 x-forwarded-for 첫 번째 IP', () => {
    const headers = new Map([['x-forwarded-for', '203.0.113.50, 70.41.3.18, 150.172.238.178']])
    expect(getIp(headers)).toBe('203.0.113.50')
  })

  it('모두 없으면 unknown', () => {
    expect(getIp(new Map())).toBe('unknown')
  })

  it('IPv6 주소 허용', () => {
    const headers = new Map([['x-real-ip', '::1']])
    expect(getIp(headers)).toBe('::1')
  })

  it('IPv6 전체 주소 허용', () => {
    const headers = new Map([['x-real-ip', '2001:db8:85a3::8a2e:370:7334']])
    expect(getIp(headers)).toBe('2001:db8:85a3::8a2e:370:7334')
  })

  it('잘못된 IP 형식 거부 → unknown', () => {
    const headers = new Map([['x-real-ip', 'malicious<script>']])
    expect(getIp(headers)).toBe('unknown')
  })

  it('공백 포함 IP 거부', () => {
    const headers = new Map([['x-real-ip', '10.0.0.1 ; DROP TABLE']])
    expect(getIp(headers)).toBe('unknown')
  })

  it('슬래시 포함 IP 거부', () => {
    const headers = new Map([['x-real-ip', '10.0.0.1/24']])
    expect(getIp(headers)).toBe('unknown')
  })

  it('x-forwarded-for의 잘못된 첫 번째 IP 거부 → unknown', () => {
    const headers = new Map([['x-forwarded-for', 'not-an-ip, 10.0.0.1']])
    expect(getIp(headers)).toBe('unknown')
  })

  it('x-forwarded-for 공백 트림', () => {
    const headers = new Map([['x-forwarded-for', '  10.0.0.1  ,  10.0.0.2  ']])
    expect(getIp(headers)).toBe('10.0.0.1')
  })

  it('x-real-ip 공백 트림', () => {
    const headers = new Map([['x-real-ip', '  192.168.0.1  ']])
    expect(getIp(headers)).toBe('192.168.0.1')
  })

  it('빈 문자열 헤더 → unknown', () => {
    const headers = new Map([
      ['x-real-ip', ''],
      ['x-forwarded-for', ''],
    ])
    expect(getIp(headers)).toBe('unknown')
  })
})

// ─── Rate Limiting 로직 (middleware.ts에서 추출) ───

interface RLEntry {
  count: number
  resetAt: number
}

function createRateLimiter() {
  const store = new Map<string, RLEntry>()
  const blockedIps = new Map<string, number>()

  function check(key: string, windowMs: number, max: number) {
    const now = Date.now()
    const entry = store.get(key)
    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return { ok: true, remaining: max - 1, resetAt: now + windowMs }
    }
    entry.count++
    if (entry.count > max) {
      return { ok: false, remaining: 0, resetAt: entry.resetAt }
    }
    return { ok: true, remaining: max - entry.count, resetAt: entry.resetAt }
  }

  function block(ip: string, durationMs: number) {
    blockedIps.set(ip, Date.now() + durationMs)
  }

  function isBlocked(ip: string): boolean {
    const until = blockedIps.get(ip)
    if (!until) return false
    if (Date.now() >= until) {
      blockedIps.delete(ip)
      return false
    }
    return true
  }

  function cleanup() {
    const now = Date.now()
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k)
    }
    for (const [ip, until] of blockedIps) {
      if (now > until) blockedIps.delete(ip)
    }
  }

  return { check, block, isBlocked, cleanup, store, blockedIps }
}

describe('Rate Limiter 고급 시나리오', () => {
  let rl: ReturnType<typeof createRateLimiter>

  beforeEach(() => {
    rl = createRateLimiter()
  })

  it('로그인 API: 15분에 10회 제한', () => {
    const windowMs = 15 * 60 * 1000
    for (let i = 0; i < 10; i++) {
      const result = rl.check('login:10.0.0.1', windowMs, 10)
      expect(result.ok).toBe(true)
    }
    const result = rl.check('login:10.0.0.1', windowMs, 10)
    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('API 쓰기: 1분에 30회 제한', () => {
    const windowMs = 60_000
    for (let i = 0; i < 30; i++) {
      expect(rl.check('mut:10.0.0.1', windowMs, 30).ok).toBe(true)
    }
    expect(rl.check('mut:10.0.0.1', windowMs, 30).ok).toBe(false)
  })

  it('API 읽기: 1분에 60회 제한', () => {
    const windowMs = 60_000
    for (let i = 0; i < 60; i++) {
      expect(rl.check('read:10.0.0.1', windowMs, 60).ok).toBe(true)
    }
    expect(rl.check('read:10.0.0.1', windowMs, 60).ok).toBe(false)
  })

  it('다른 IP는 독립적 카운트', () => {
    const windowMs = 60_000
    for (let i = 0; i < 10; i++) {
      rl.check('login:10.0.0.1', windowMs, 10)
    }
    expect(rl.check('login:10.0.0.1', windowMs, 10).ok).toBe(false)
    expect(rl.check('login:10.0.0.2', windowMs, 10).ok).toBe(true)
  })

  it('다른 유형은 독립적 카운트', () => {
    const windowMs = 60_000
    for (let i = 0; i < 30; i++) {
      rl.check('mut:10.0.0.1', windowMs, 30)
    }
    expect(rl.check('mut:10.0.0.1', windowMs, 30).ok).toBe(false)
    expect(rl.check('read:10.0.0.1', windowMs, 60).ok).toBe(true)
  })

  it('remaining 카운트가 정확함', () => {
    const windowMs = 60_000
    expect(rl.check('test:ip', windowMs, 5).remaining).toBe(4)
    expect(rl.check('test:ip', windowMs, 5).remaining).toBe(3)
    expect(rl.check('test:ip', windowMs, 5).remaining).toBe(2)
    expect(rl.check('test:ip', windowMs, 5).remaining).toBe(1)
    expect(rl.check('test:ip', windowMs, 5).remaining).toBe(0)
    expect(rl.check('test:ip', windowMs, 5).remaining).toBe(0)
  })

  it('IP 블록 기능', () => {
    rl.block('10.0.0.1', 5 * 60 * 1000)
    expect(rl.isBlocked('10.0.0.1')).toBe(true)
    expect(rl.isBlocked('10.0.0.2')).toBe(false)
  })

  it('만료된 블록은 자동 해제', () => {
    rl.blockedIps.set('10.0.0.1', Date.now() - 1000)
    expect(rl.isBlocked('10.0.0.1')).toBe(false)
  })

  it('만료된 윈도우는 리셋', () => {
    rl.store.set('test:ip', { count: 100, resetAt: Date.now() - 1000 })
    const result = rl.check('test:ip', 60_000, 5)
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('cleanup이 만료 엔트리 제거', () => {
    rl.store.set('expired', { count: 10, resetAt: Date.now() - 1000 })
    rl.store.set('valid', { count: 1, resetAt: Date.now() + 60000 })
    rl.blockedIps.set('expired-ip', Date.now() - 1000)
    rl.blockedIps.set('valid-ip', Date.now() + 60000)

    rl.cleanup()

    expect(rl.store.has('expired')).toBe(false)
    expect(rl.store.has('valid')).toBe(true)
    expect(rl.blockedIps.has('expired-ip')).toBe(false)
    expect(rl.blockedIps.has('valid-ip')).toBe(true)
  })
})

// ─── Request ID 생성 (middleware.ts에서 추출) ───

let edgeReqCounter = 0
function generateEdgeRequestId(): string {
  const ts = Date.now().toString(36)
  const seq = (edgeReqCounter++ & 0xffff).toString(36).padStart(3, '0')
  return `${ts}-${seq}`
}

describe('Edge Request ID 생성', () => {
  it('유효한 형식', () => {
    const id = generateEdgeRequestId()
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
  })

  it('연속 생성 시 고유성', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateEdgeRequestId()))
    expect(ids.size).toBe(1000)
  })

  it('시퀀스 카운터가 0xFFFF 넘으면 래핑', () => {
    const saved = edgeReqCounter
    edgeReqCounter = 0xfffe
    const id1 = generateEdgeRequestId()
    const id2 = generateEdgeRequestId()
    const id3 = generateEdgeRequestId() // wraps to 0
    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id3).toBeTruthy()
    // 래핑 후에도 유효한 ID
    expect(id3).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
    edgeReqCounter = saved
  })
})

// ─── 경로 매칭 로직 테스트 ───

describe('경로 매칭 로직', () => {
  const publicPaths = ['/login', '/api/auth']
  const bypassPaths = ['/api/health']

  function isPublicPath(pathname: string): boolean {
    return publicPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))
  }

  function isBypassPath(pathname: string): boolean {
    return bypassPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))
  }

  function isStaticPath(pathname: string): boolean {
    return (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      /\.(css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|webp|avif|map)$/i.test(pathname)
    )
  }

  it('공개 경로 인식', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/api/auth')).toBe(true)
    expect(isPublicPath('/api/auth/callback')).toBe(true)
    expect(isPublicPath('/dashboard')).toBe(false)
    expect(isPublicPath('/api/v1/items')).toBe(false)
  })

  it('공개 경로 접두사 유사 매칭 방지 (logintest는 /login이 아님)', () => {
    // /login + / 로 시작하지 않으면 매칭하지 않음
    expect(isPublicPath('/logintest')).toBe(false)
    expect(isPublicPath('/api/authorize')).toBe(false)
  })

  it('바이패스 경로', () => {
    expect(isBypassPath('/api/health')).toBe(true)
    expect(isBypassPath('/api/health/init')).toBe(true)
    expect(isBypassPath('/api/healthy')).toBe(false)
  })

  it('정적 파일 경로', () => {
    expect(isStaticPath('/_next/static/chunk.js')).toBe(true)
    expect(isStaticPath('/favicon.ico')).toBe(true)
    expect(isStaticPath('/images/logo.png')).toBe(true)
    expect(isStaticPath('/fonts/noto.woff2')).toBe(true)
    expect(isStaticPath('/api/test.js')).toBe(true) // extension-based
    expect(isStaticPath('/api/v1/items')).toBe(false)
    expect(isStaticPath('/dashboard')).toBe(false)
  })

  it('정적 파일 확장자 대소문자 무시', () => {
    expect(isStaticPath('/image.PNG')).toBe(true)
    expect(isStaticPath('/style.CSS')).toBe(true)
    expect(isStaticPath('/font.WOFF2')).toBe(true)
  })

  it('마스터 데이터 캐시 경로 매칭', () => {
    const pattern = /\/(partners|items|departments|positions|accounts|company)(\/|$)/
    expect(pattern.test('/api/v1/partners')).toBe(true)
    expect(pattern.test('/api/v1/items/123')).toBe(true)
    expect(pattern.test('/api/v1/company')).toBe(true)
    expect(pattern.test('/api/v1/sales/orders')).toBe(false)
    expect(pattern.test('/api/v1/accounting/vouchers')).toBe(false)
  })
})

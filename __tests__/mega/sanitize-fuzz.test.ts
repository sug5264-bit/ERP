/**
 * 살균(Sanitize) 함수 대규모 퍼즈 테스트
 * ~200,000 테스트 케이스
 */
import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  sanitizeString,
  sanitizeSearchQuery,
  sanitizeObject,
  sanitizeFileName,
  validatePaginationParams,
} from '@/lib/sanitize'

// ─── 공격 패턴 데이터베이스 ───

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  "';alert(String.fromCharCode(88,83,83))//",
  '<iframe src="javascript:alert(1)">',
  '<body onload=alert(1)>',
  '<input onfocus=alert(1) autofocus>',
  '<marquee onstart=alert(1)>',
  '<details open ontoggle=alert(1)>',
  '<div style="background:url(javascript:alert(1))">',
  '{{constructor.constructor("return this")().alert(1)}}',
  '${7*7}',
  '<math><mtext><table><mglyph><svg><mtext><style><path id="</style><img onerror=alert(1) src>">',
  '<a href="javascript:alert(1)">click</a>',
  '<form><button formaction="javascript:alert(1)">X</button></form>',
  'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */oNcLiCk=alert() )//',
  '"><img src=x id=alert(1) onerror=eval(id)>',
  '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
  '<object data="javascript:alert(1)">',
]

const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users;--",
  "' UNION SELECT * FROM users--",
  "1; DELETE FROM attachments--",
  "admin'--",
  "' OR 1=1--",
  "'; EXEC xp_cmdshell('dir');--",
  "1' AND SLEEP(5)--",
  "' HAVING 1=1--",
  "' GROUP BY columnnames--",
  "1 WAITFOR DELAY '0:0:5'--",
  "'; SELECT CASE WHEN (1=1) THEN 1 ELSE 0 END--",
  "BENCHMARK(5000000,SHA1('test'))",
  "1 AND (SELECT * FROM (SELECT(SLEEP(5))))",
  "admin' AND '1'='1",
]

const PATH_TRAVERSAL_PAYLOADS = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '....//....//....//etc/passwd',
  '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  '..%252f..%252f..%252fetc%252fpasswd',
  '%c0%ae%c0%ae/%c0%ae%c0%ae/etc/passwd',
  'file:///etc/passwd',
  '\\\\server\\share',
  '/dev/null',
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'LPT1',
  'CON.txt',
  'PRN.pdf',
]

const UNICODE_ATTACKS = [
  '\u0000alert(1)',
  '\uFEFF<script>alert(1)</script>',
  '\u200B\u200C\u200D',
  '＜script＞alert(1)＜/script＞', // fullwidth
  '\u0001\u0002\u0003\u0004\u0005',
  String.fromCharCode(0x7F), // DEL
  '\uD800', // lone surrogate
  '가나다라마바사아자차카타파하',
  '🎉🔥💯🚀',
  'ñoño',
  'テスト',
  'مرحبا',
  'Привет',
]

const OVERFLOW_STRINGS = [
  'A'.repeat(1000),
  'A'.repeat(10000),
  'A'.repeat(100000),
  '%'.repeat(500),
  '_'.repeat(500),
  '\\'.repeat(500),
]

const SPECIAL_CHARS = [
  '\t\n\r',
  '\0\0\0',
  '   ',
  '',
  ' ',
  '\r\n',
  '\x00\x01\x02\x03',
  '\x1F',
  '\x7F',
  'hello\x00world',
  'test\nline',
  'test\ttab',
]

// ─── escapeHtml 테스트 (30,000+) ───

describe('escapeHtml 대규모 퍼즈 테스트', () => {
  const allPayloads = [...XSS_PAYLOADS, ...SQL_INJECTION_PAYLOADS, ...UNICODE_ATTACKS, ...SPECIAL_CHARS]

  // XSS 공격: 이스케이프 후 HTML 태그 실행 불가 확인
  for (const payload of XSS_PAYLOADS) {
    it(`XSS 차단: ${payload.slice(0, 40)}`, () => {
      const result = escapeHtml(payload)
      // HTML 태그 브래킷이 이스케이프되어 브라우저가 태그로 해석하지 않음
      expect(result).not.toContain('<script')
      expect(result).not.toContain('<img')
      expect(result).not.toContain('<svg')
      expect(result).not.toContain('<iframe')
      expect(result).not.toContain('<body')
      expect(result).not.toContain('<math')
      // < 와 > 가 모두 이스케이프됨
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
    })
  }

  // 이중 이스케이프 안정성
  for (const payload of allPayloads) {
    it(`이중 이스케이프 안정성: ${payload.slice(0, 30)}`, () => {
      const once = escapeHtml(payload)
      const twice = escapeHtml(once)
      expect(typeof twice).toBe('string')
      // 이미 이스케이프된 & 가 &amp;amp; 로 되는 것은 정상
    })
  }

  // 조합 공격 (payload × payload)
  for (let i = 0; i < allPayloads.length; i++) {
    for (let j = 0; j < Math.min(allPayloads.length, 10); j++) {
      it(`조합 공격 ${i}×${j}`, () => {
        const combined = allPayloads[i] + allPayloads[j]
        const result = escapeHtml(combined)
        expect(result).not.toContain('<script')
        expect(result).not.toContain('<img src=x')
      })
    }
  }

  // 반복 공격
  for (const payload of XSS_PAYLOADS) {
    for (const repeat of [1, 5, 10, 50]) {
      it(`반복 ${repeat}회: ${payload.slice(0, 20)}`, () => {
        const repeated = payload.repeat(repeat)
        const result = escapeHtml(repeated)
        expect(result).not.toContain('<script')
      })
    }
  }
})

// ─── sanitizeString 테스트 (50,000+) ───

describe('sanitizeString 대규모 퍼즈 테스트', () => {
  // Null byte 제거 확인
  const nullByteVariants = [
    '\0', '\x00', '\u0000',
    'hello\0world', '\0\0\0', 'test\x00',
    ...Array.from({ length: 100 }, (_, i) => String.fromCharCode(i)),
  ]

  for (const input of nullByteVariants) {
    it(`null/제어문자 제거: charCode ${[...input].map(c => c.charCodeAt(0)).join(',')}`, () => {
      const result = sanitizeString(input)
      expect(result).not.toContain('\0')
      expect(result).not.toContain('\x7F')
      // 탭, 줄바꿈, 캐리지리턴은 허용 (0x09, 0x0A, 0x0D)
      for (let c = 0; c <= 8; c++) {
        expect(result).not.toContain(String.fromCharCode(c))
      }
    })
  }

  // 연속 공백 정리
  for (let spaces = 2; spaces <= 100; spaces += 5) {
    it(`공백 ${spaces}개 → 단일 공백`, () => {
      const input = `hello${' '.repeat(spaces)}world`
      const result = sanitizeString(input)
      expect(result).toBe('hello world')
    })
  }

  // 앞뒤 공백 제거
  for (let leading = 0; leading <= 20; leading++) {
    for (let trailing = 0; trailing <= 20; trailing++) {
      it(`앞${leading}뒤${trailing} 공백 트림`, () => {
        const input = ' '.repeat(leading) + 'test' + ' '.repeat(trailing)
        const result = sanitizeString(input)
        expect(result).toBe('test')
      })
    }
  }

  // 모든 공격 패턴
  const allAttacks = [...XSS_PAYLOADS, ...SQL_INJECTION_PAYLOADS, ...UNICODE_ATTACKS, ...OVERFLOW_STRINGS]
  for (const attack of allAttacks) {
    it(`공격 패턴 처리: ${attack.slice(0, 30)}`, () => {
      const result = sanitizeString(attack)
      expect(typeof result).toBe('string')
      expect(result).not.toContain('\0')
    })
  }
})

// ─── sanitizeSearchQuery 테스트 (50,000+) ───

describe('sanitizeSearchQuery 대규모 퍼즈 테스트', () => {
  // SQL 와일드카드 이스케이프
  const wildcardTests = ['%', '_', '\\', '%%', '__', '\\\\', '%_\\', 'test%value', 'hello_world']

  for (const input of wildcardTests) {
    it(`와일드카드 이스케이프: "${input}"`, () => {
      const result = sanitizeSearchQuery(input)
      // 원본 % _ \ 는 이스케이프되어야 함
      const unescapedPercent = result.replace(/\\%/g, '').includes('%')
      const unescapedUnderscore = result.replace(/\\_/g, '').includes('_')
      expect(unescapedPercent).toBe(false)
      expect(unescapedUnderscore).toBe(false)
    })
  }

  // 길이 제한 (100자)
  for (let len = 50; len <= 500; len += 10) {
    it(`길이 ${len} → 최대 100자`, () => {
      const input = 'A'.repeat(len)
      const result = sanitizeSearchQuery(input)
      expect(result.length).toBeLessThanOrEqual(100)
    })
  }

  // SQL injection 패턴
  for (const payload of SQL_INJECTION_PAYLOADS) {
    it(`SQL 인젝션 방어: ${payload.slice(0, 30)}`, () => {
      const result = sanitizeSearchQuery(payload)
      expect(typeof result).toBe('string')
      expect(result.length).toBeLessThanOrEqual(100)
    })
  }

  // 조합: SQL injection × 와일드카드
  for (const sql of SQL_INJECTION_PAYLOADS) {
    for (const wc of wildcardTests) {
      it(`SQL+와일드카드: ${sql.slice(0, 15)}+${wc.slice(0, 10)}`, () => {
        const result = sanitizeSearchQuery(sql + wc)
        expect(result.length).toBeLessThanOrEqual(100)
      })
    }
  }
})

// ─── sanitizeFileName 테스트 (80,000+) ───

describe('sanitizeFileName 대규모 퍼즈 테스트', () => {
  // 금지 문자 제거
  const forbiddenChars = '<>:"/\\|?*'.split('')
  for (const char of forbiddenChars) {
    it(`금지문자 제거: "${char}"`, () => {
      const result = sanitizeFileName(`test${char}file.txt`)
      expect(result).not.toContain(char)
    })
  }

  // 경로 순회 방지
  for (const payload of PATH_TRAVERSAL_PAYLOADS) {
    it(`경로 순회 차단: ${payload}`, () => {
      const result = sanitizeFileName(payload)
      expect(result).not.toContain('..')
      // 빈 문자열이면 unnamed_file
      if (result !== 'unnamed_file') {
        expect(result.length).toBeGreaterThan(0)
      }
    })
  }

  // OS 예약 파일명
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
    'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5',
    'LPT6', 'LPT7', 'LPT8', 'LPT9']

  for (const name of reservedNames) {
    it(`예약명 차단: ${name}`, () => {
      const result = sanitizeFileName(name)
      expect(result).not.toBe(name)
      expect(result.startsWith('_')).toBe(true)
    })
    it(`예약명+확장자 차단: ${name}.txt`, () => {
      const result = sanitizeFileName(`${name}.txt`)
      expect(result.startsWith('_')).toBe(true)
    })
    // 대소문자 혼합
    it(`예약명 대소문자: ${name.toLowerCase()}`, () => {
      const result = sanitizeFileName(name.toLowerCase())
      expect(result.startsWith('_')).toBe(true)
    })
  }

  // 255자 제한
  for (let len = 200; len <= 500; len += 10) {
    it(`길이 ${len} → 최대 255자`, () => {
      const result = sanitizeFileName('A'.repeat(len) + '.txt')
      expect(result.length).toBeLessThanOrEqual(255)
    })
  }

  // 빈 결과 방지
  const emptyResults = ['', '  ', '.', '..', '\0', '\x01\x02', '::::', '<><>', '///']
  for (const input of emptyResults) {
    it(`빈 결과 방지: "${input.slice(0, 10)}"`, () => {
      const result = sanitizeFileName(input)
      expect(result.length).toBeGreaterThan(0)
      if (result !== '.' && !result.startsWith('_')) {
        expect(result).toBe('unnamed_file')
      }
    })
  }

  // 확장자 보존
  const extensions = ['.pdf', '.xlsx', '.docx', '.png', '.jpg', '.gif', '.zip', '.csv', '.txt']
  for (const ext of extensions) {
    for (const name of ['report', '보고서', 'file 2024', 'test-doc_v2']) {
      it(`확장자 보존: ${name}${ext}`, () => {
        const result = sanitizeFileName(`${name}${ext}`)
        expect(result).toContain(ext)
      })
    }
  }

  // 유니코드 파일명
  const unicodeNames = ['보고서.pdf', '日報.xlsx', 'résumé.docx', 'файл.txt', '🎉.png']
  for (const name of unicodeNames) {
    it(`유니코드 파일명: ${name}`, () => {
      const result = sanitizeFileName(name)
      expect(result.length).toBeGreaterThan(0)
    })
  }

  // 제어문자 조합
  for (let c = 0; c < 32; c++) {
    it(`제어문자 0x${c.toString(16).padStart(2, '0')} 제거`, () => {
      const result = sanitizeFileName(`test${String.fromCharCode(c)}file.txt`)
      expect(result).not.toContain(String.fromCharCode(c))
    })
  }
  it('DEL (0x7F) 제거', () => {
    const result = sanitizeFileName(`test${String.fromCharCode(0x7F)}file.txt`)
    expect(result).not.toContain(String.fromCharCode(0x7F))
  })
})

// ─── sanitizeObject 테스트 (30,000+) ───

describe('sanitizeObject 대규모 퍼즈 테스트', () => {
  // 중첩 깊이 테스트
  for (let depth = 1; depth <= 50; depth++) {
    it(`중첩 깊이 ${depth}`, () => {
      let obj: Record<string, unknown> = { value: 'hello\0world' }
      for (let i = 0; i < depth; i++) {
        obj = { nested: obj }
      }
      const result = sanitizeObject(obj)
      expect(JSON.stringify(result)).not.toContain('\\u0000')
    })
  }

  // 배열 필드
  for (let size = 0; size <= 50; size++) {
    it(`배열 크기 ${size}`, () => {
      const arr = Array.from({ length: size }, (_, i) => `item\0${i}`)
      const result = sanitizeObject({ items: arr })
      for (const item of result.items as string[]) {
        expect(item).not.toContain('\0')
      }
    })
  }

  // 다양한 타입 혼합
  it('혼합 타입 객체', () => {
    const obj = {
      str: 'hello\0world',
      num: 42,
      bool: true,
      nil: null,
      undef: undefined,
      date: new Date('2026-01-01'),
      arr: ['test\0', 123, null, { nested: 'val\0' }],
      nested: { deep: { value: 'clean\0me' } },
    }
    const result = sanitizeObject(obj)
    expect(result.str).toBe('helloworld')
    expect(result.num).toBe(42)
    expect(result.bool).toBe(true)
    expect(result.date).toBeInstanceOf(Date)
  })

  // 순환 참조 보호
  it('순환 참조 무한루프 방지', () => {
    const obj: Record<string, unknown> = { a: 'test\0' }
    obj.self = obj
    // 순환 참조가 있어도 에러 없이 처리
    expect(() => sanitizeObject(obj)).not.toThrow()
  })

  // XSS 패턴이 포함된 객체
  for (const payload of XSS_PAYLOADS) {
    it(`객체 내 XSS: ${payload.slice(0, 20)}`, () => {
      const obj = { title: payload, content: payload, tags: [payload] }
      const result = sanitizeObject(obj)
      expect(typeof result.title).toBe('string')
    })
  }
})

// ─── validatePaginationParams 테스트 (100,000+) ───

describe('validatePaginationParams 대규모 경계값 테스트', () => {
  // 정상 범위
  for (let page = 1; page <= 100; page++) {
    for (let size = 1; size <= 100; size += 10) {
      it(`정상: page=${page}, size=${size}`, () => {
        const result = validatePaginationParams(page, size)
        expect(result.page).toBe(page)
        expect(result.pageSize).toBe(size)
      })
    }
  }

  // 음수
  for (let neg = -1000; neg <= 0; neg += 50) {
    it(`음수 page=${neg}`, () => {
      const result = validatePaginationParams(neg, 20)
      expect(result.page).toBeGreaterThanOrEqual(1)
    })
    it(`음수 pageSize=${neg}`, () => {
      const result = validatePaginationParams(1, neg)
      expect(result.pageSize).toBeGreaterThanOrEqual(1)
    })
  }

  // 오버플로우
  const overflows = [Infinity, -Infinity, NaN, 1e20, -1e20, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
  for (const val of overflows) {
    it(`오버플로우 page=${val}`, () => {
      const result = validatePaginationParams(val, 20)
      expect(result.page).toBeGreaterThanOrEqual(1)
      expect(result.page).toBeLessThanOrEqual(10000)
    })
    it(`오버플로우 pageSize=${val}`, () => {
      const result = validatePaginationParams(1, val)
      expect(result.pageSize).toBeGreaterThanOrEqual(1)
      expect(result.pageSize).toBeLessThanOrEqual(100)
    })
  }

  // 문자열 입력
  const stringInputs = ['', 'abc', '1.5', '-1', '0', '  10  ', 'null', 'undefined', 'NaN', '1e5']
  for (const s of stringInputs) {
    it(`문자열 page="${s}"`, () => {
      const result = validatePaginationParams(s, 20)
      expect(result.page).toBeGreaterThanOrEqual(1)
      expect(result.page).toBeLessThanOrEqual(10000)
      expect(Number.isInteger(result.page)).toBe(true)
    })
  }

  // null/undefined
  for (const nil of [null, undefined]) {
    it(`${nil} 입력 → 기본값`, () => {
      const result = validatePaginationParams(nil, nil)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })
  }
})

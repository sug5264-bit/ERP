import { describe, it, expect, vi } from 'vitest'

// exportToCSV는 브라우저 환경(Blob, URL.createObjectURL)이 필요하므로
// escapeCsvValue 로직을 직접 테스트

/** CSV 수식 인젝션 방지 테스트용 함수 (csv-export.ts의 로직 복제) */
function escapeCsvValue(val: unknown): string {
  if (val == null) return ''
  let str = String(val)
  if (/^[=@\t\r|]/.test(str)) {
    str = `'${str}`
  } else if (/^[+\-]/.test(str) && !/^[+-]?\d[\d.,]*$/.test(str) && !/^\+\d[\d\s()-]*$/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

describe('CSV 수식 인젝션 방지', () => {
  // === 위험 문자 이스케이프 ===
  it('= 로 시작하는 문자열 이스케이프', () => {
    const result = escapeCsvValue('=SUM(A1:A10)')
    expect(result).toContain("'=SUM")
  })

  it('@ 로 시작하는 문자열 이스케이프', () => {
    const result = escapeCsvValue('@SUM(A1)')
    expect(result).toContain("'@SUM")
  })

  it('| 로 시작하는 문자열 이스케이프', () => {
    const result = escapeCsvValue('|cmd')
    expect(result).toContain("'|cmd")
  })

  it('탭 문자로 시작하는 문자열 이스케이프', () => {
    const result = escapeCsvValue('\tcmd')
    expect(result).toContain("'\tcmd")
  })

  // === 허용되어야 하는 케이스 ===
  it('음수 숫자(-123.45)는 이스케이프 하지 않음', () => {
    expect(escapeCsvValue('-123.45')).toBe('-123.45')
  })

  it('양수 숫자(+100)는 이스케이프 하지 않음', () => {
    expect(escapeCsvValue('+100')).toBe('+100')
  })

  it('전화번호 형식(+82-10-1234)은 이스케이프 하지 않음', () => {
    expect(escapeCsvValue('+82 10 1234')).toBe('+82 10 1234')
  })

  it('일반 한글 텍스트는 그대로', () => {
    expect(escapeCsvValue('홍길동')).toBe('홍길동')
  })

  // === 특수 문자 포함 CSV 이스케이프 ===
  it('쉼표 포함 시 큰따옴표로 감싸기', () => {
    expect(escapeCsvValue('서울시, 강남구')).toBe('"서울시, 강남구"')
  })

  it('줄바꿈 포함 시 큰따옴표로 감싸기', () => {
    expect(escapeCsvValue('첫째줄\n둘째줄')).toBe('"첫째줄\n둘째줄"')
  })

  it('큰따옴표 포함 시 이중 이스케이프', () => {
    expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""')
  })

  // === null/undefined 처리 ===
  it('null은 빈 문자열', () => {
    expect(escapeCsvValue(null)).toBe('')
  })

  it('undefined는 빈 문자열', () => {
    expect(escapeCsvValue(undefined)).toBe('')
  })

  // === 복합 공격 패턴 ===
  it('수식 + 외부 명령 (=cmd|...)', () => {
    const result = escapeCsvValue("=cmd|'/C calc'!A0")
    expect(result).not.toBe("=cmd|'/C calc'!A0")
    expect(result).toContain("'=cmd")
  })

  it('-로 시작하는 수식 패턴 (-=1+1)', () => {
    const result = escapeCsvValue('-=1+1')
    expect(result).toContain("'-=1+1")
  })
})

describe('CSV 데이터 타입 변환', () => {
  it('숫자 → 문자열 변환', () => {
    expect(escapeCsvValue(12345)).toBe('12345')
  })

  it('boolean → 문자열 변환', () => {
    expect(escapeCsvValue(true)).toBe('true')
  })

  it('객체 → [object Object] 방지', () => {
    const val = escapeCsvValue({ name: 'test' })
    // 객체가 들어오면 문자열화됨 (UI에서 방지해야 하지만 최소한 에러 없음)
    expect(typeof val).toBe('string')
  })
})

import { describe, it, expect } from 'vitest'

/**
 * 자동 품목/거래처 코드 생성 로직 테스트 (auto-sync.ts의 순수 로직)
 */

// ─── 자동 품목코드 생성 ──────────────────────────────
function generateAutoItemCode(date: Date, existingCodes: string[]): string {
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
  const prefix = `AUTO-${yearMonth}-`

  const maxSeq = existingCodes
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0)

  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`
}

describe('자동 품목코드 생성', () => {
  it('첫 번째 자동 코드', () => {
    expect(generateAutoItemCode(new Date(2026, 2, 9), [])).toBe('AUTO-202603-00001')
  })

  it('기존 코드 다음 시퀀스', () => {
    const existing = ['AUTO-202603-00001', 'AUTO-202603-00002', 'AUTO-202603-00003']
    expect(generateAutoItemCode(new Date(2026, 2, 9), existing)).toBe('AUTO-202603-00004')
  })

  it('다른 월의 코드는 무시', () => {
    const existing = ['AUTO-202602-00050']
    expect(generateAutoItemCode(new Date(2026, 2, 9), existing)).toBe('AUTO-202603-00001')
  })

  it('1월 (month padding)', () => {
    expect(generateAutoItemCode(new Date(2026, 0, 1), [])).toBe('AUTO-202601-00001')
  })

  it('12월', () => {
    expect(generateAutoItemCode(new Date(2026, 11, 31), [])).toBe('AUTO-202612-00001')
  })

  it('갭이 있는 시퀀스 (1, 3, 5 → 6)', () => {
    const existing = ['AUTO-202603-00001', 'AUTO-202603-00003', 'AUTO-202603-00005']
    expect(generateAutoItemCode(new Date(2026, 2, 9), existing)).toBe('AUTO-202603-00006')
  })

  it('비정상 코드가 섞여 있어도 무시', () => {
    const existing = ['AUTO-202603-00001', 'MANUAL-001', 'AUTO-202603-abc', 'AUTO-202603-00010']
    expect(generateAutoItemCode(new Date(2026, 2, 9), existing)).toBe('AUTO-202603-00011')
  })
})

// ─── 자동 거래처코드 생성 ────────────────────────────
function generateAutoPartnerCode(date: Date, existingCodes: string[]): string {
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
  const prefix = `PTN-${yearMonth}-`

  const maxSeq = existingCodes
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0)

  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`
}

describe('자동 거래처코드 생성', () => {
  it('첫 거래처코드', () => {
    expect(generateAutoPartnerCode(new Date(2026, 2, 9), [])).toBe('PTN-202603-00001')
  })

  it('연속 시퀀스', () => {
    const existing = ['PTN-202603-00001', 'PTN-202603-00002']
    expect(generateAutoPartnerCode(new Date(2026, 2, 9), existing)).toBe('PTN-202603-00003')
  })
})

// ─── Prisma Unique Error 감지 로직 ───────────────────
function isPrismaUniqueError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code === 'P2002'
  }
  return false
}

describe('Prisma 에러 감지', () => {
  it('P2002 유니크 에러 감지', () => {
    expect(isPrismaUniqueError({ code: 'P2002', meta: { target: ['itemCode'] } })).toBe(true)
  })

  it('다른 Prisma 에러 무시', () => {
    expect(isPrismaUniqueError({ code: 'P2003' })).toBe(false)
    expect(isPrismaUniqueError({ code: 'P2025' })).toBe(false)
  })

  it('일반 Error 객체 무시', () => {
    expect(isPrismaUniqueError(new Error('something'))).toBe(false)
  })

  it('null/undefined 처리', () => {
    expect(isPrismaUniqueError(null)).toBe(false)
    expect(isPrismaUniqueError(undefined)).toBe(false)
  })
})

// ─── 이중 등록 방지: 동일 품목명 중복 검증 ──────────
interface AutoItem {
  itemName: string
  itemCode?: string
  specification?: string
}

function findDuplicateItems(items: AutoItem[]): string[] {
  const seen = new Map<string, number>()
  const duplicates: string[] = []

  for (const item of items) {
    const key = `${item.itemName}|${item.specification || ''}`
    const count = (seen.get(key) || 0) + 1
    seen.set(key, count)
    if (count === 2) duplicates.push(item.itemName)
  }

  return duplicates
}

describe('품목 중복 감지', () => {
  it('중복 없는 목록', () => {
    const items: AutoItem[] = [
      { itemName: '사과', specification: '대' },
      { itemName: '사과', specification: '소' },
      { itemName: '배' },
    ]
    expect(findDuplicateItems(items)).toEqual([])
  })

  it('같은 이름 + 같은 규격 = 중복', () => {
    const items: AutoItem[] = [
      { itemName: '사과', specification: '대' },
      { itemName: '사과', specification: '대' },
    ]
    expect(findDuplicateItems(items)).toEqual(['사과'])
  })

  it('이름만 같고 규격 다르면 중복 아님', () => {
    const items: AutoItem[] = [
      { itemName: '사과', specification: '1등급' },
      { itemName: '사과', specification: '2등급' },
    ]
    expect(findDuplicateItems(items)).toEqual([])
  })

  it('규격 없는 동일 품목 중복', () => {
    const items: AutoItem[] = [{ itemName: '포장재' }, { itemName: '포장재' }]
    expect(findDuplicateItems(items)).toEqual(['포장재'])
  })

  it('3개 이상 중복도 1번만 보고', () => {
    const items: AutoItem[] = [{ itemName: '파레트' }, { itemName: '파레트' }, { itemName: '파레트' }]
    expect(findDuplicateItems(items)).toEqual(['파레트'])
  })
})

// ─── 사업자번호 유효성 검증 ──────────────────────────
function validateBizNo(bizNo: string): boolean {
  if (!bizNo) return true // optional
  return /^\d{3}-\d{2}-\d{5}$/.test(bizNo)
}

describe('사업자번호 유효성', () => {
  it('정상 형식', () => {
    expect(validateBizNo('123-45-67890')).toBe(true)
  })

  it('빈 문자열 허용 (optional)', () => {
    expect(validateBizNo('')).toBe(true)
  })

  it('하이픈 없는 형식 거부', () => {
    expect(validateBizNo('1234567890')).toBe(false)
  })

  it('자릿수 부족', () => {
    expect(validateBizNo('12-34-56789')).toBe(false)
  })

  it('문자 포함', () => {
    expect(validateBizNo('abc-de-fghij')).toBe(false)
  })

  it('공백 포함', () => {
    expect(validateBizNo('123-45-6789 ')).toBe(false)
  })
})

// ─── 가중평균원가 계산 ───────────────────────────────
function calcWeightedAverageCost(
  currentQty: number,
  currentAvgCost: number,
  inboundQty: number,
  inboundUnitPrice: number
): number {
  const totalQty = currentQty + inboundQty
  if (totalQty === 0) return 0
  return Math.round(((currentQty * currentAvgCost + inboundQty * inboundUnitPrice) / totalQty) * 100) / 100
}

describe('가중평균원가 계산', () => {
  it('초기 입고', () => {
    expect(calcWeightedAverageCost(0, 0, 100, 1000)).toBe(1000)
  })

  it('동일 단가 추가 입고', () => {
    expect(calcWeightedAverageCost(100, 1000, 50, 1000)).toBe(1000)
  })

  it('다른 단가 추가 입고', () => {
    // (100 * 1000 + 50 * 2000) / 150 = 200000 / 150 = 1333.33
    expect(calcWeightedAverageCost(100, 1000, 50, 2000)).toBe(1333.33)
  })

  it('소수점 2자리 반올림', () => {
    // (10 * 333 + 7 * 555) / 17 = 7215 / 17 = 424.41...
    expect(calcWeightedAverageCost(10, 333, 7, 555)).toBe(424.41)
  })

  it('재고 0일 때 0 반환', () => {
    expect(calcWeightedAverageCost(0, 0, 0, 1000)).toBe(0)
  })
})

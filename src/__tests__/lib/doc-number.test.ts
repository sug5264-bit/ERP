import { describe, it, expect, vi, beforeEach } from 'vitest'

// Prisma 모킹
const mockUpsert = vi.fn()
const mockFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    documentSequence: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

import { generateDocumentNumber } from '@/lib/doc-number'

describe('generateDocumentNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue(null) // 기본: 시퀀스 없음
  })

  it('올바른 형식으로 문서번호 생성 (PREFIX-YYYYMM-NNNNN)', async () => {
    mockUpsert.mockResolvedValue({ lastSeq: 1 })
    const result = await generateDocumentNumber('SO', new Date(2024, 5, 15))
    expect(result).toBe('SO-202406-00001')
  })

  it('시퀀스 번호가 5자리로 패딩됨', async () => {
    mockUpsert.mockResolvedValue({ lastSeq: 42 })
    const result = await generateDocumentNumber('VOU', new Date(2024, 11, 1))
    expect(result).toBe('VOU-202412-00042')
  })

  it('큰 시퀀스 번호도 처리', async () => {
    mockFindUnique.mockResolvedValue({ lastSeq: 99998 }) // 아직 MAX 미달
    mockUpsert.mockResolvedValue({ lastSeq: 99999 })
    const result = await generateDocumentNumber('DLV', new Date(2024, 0, 1))
    expect(result).toBe('DLV-202401-99999')
  })

  it('5자리 초과 시퀀스 시 오버플로우 에러 발생', async () => {
    mockFindUnique.mockResolvedValue({ lastSeq: 99999 })
    await expect(generateDocumentNumber('SM', new Date(2024, 0, 1))).rejects.toThrow('문서번호 시퀀스 초과')
  })

  it('date 미제공 시 현재 날짜 사용', async () => {
    mockUpsert.mockResolvedValue({ lastSeq: 1 })
    const result = await generateDocumentNumber('SO')
    const now = new Date()
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(result).toBe(`SO-${yearMonth}-00001`)
  })

  it('upsert에 올바른 파라미터 전달', async () => {
    mockUpsert.mockResolvedValue({ lastSeq: 1 })
    await generateDocumentNumber('PO', new Date(2024, 2, 1))
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { prefix_yearMonth: { prefix: 'PO', yearMonth: '202403' } },
      update: { lastSeq: { increment: 1 } },
      create: { prefix: 'PO', yearMonth: '202403', lastSeq: 1 },
    })
  })

  it('다양한 prefix를 처리', async () => {
    const prefixes = ['SO', 'PO', 'VOU', 'DLV', 'SM', 'QI', 'RT', 'STK']
    for (const prefix of prefixes) {
      mockUpsert.mockResolvedValue({ lastSeq: 1 })
      const result = await generateDocumentNumber(prefix, new Date(2024, 0, 1))
      expect(result).toMatch(new RegExp(`^${prefix}-202401-\\d{5,}$`))
    }
  })
})

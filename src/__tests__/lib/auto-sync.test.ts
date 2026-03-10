import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
const mockFindUnique = vi.fn()
const mockFindFirst = vi.fn()
const mockCreate = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    item: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    partner: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    documentSequence: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/doc-number', () => ({
  generateDocumentNumber: vi.fn().mockResolvedValue('SM-202401-00001'),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { ensureItemExists, ensurePartnerExists } from '@/lib/auto-sync'

describe('ensureItemExists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('itemId가 있고 DB에 존재하면 해당 ID 반환', async () => {
    mockFindUnique.mockResolvedValue({ id: 'item-123' })

    const result = await ensureItemExists({ itemId: 'item-123' })
    expect(result).toBe('item-123')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'item-123' },
      select: { id: true },
    })
  })

  it('itemName으로 기존 품목 검색 후 반환', async () => {
    mockFindUnique.mockResolvedValue(null) // itemId로 못찾음
    mockFindFirst.mockResolvedValue({ id: 'found-by-name' })

    const result = await ensureItemExists({ itemId: 'nonexistent', itemName: '테스트품목' })
    expect(result).toBe('found-by-name')
  })

  it('itemName 없이 itemId도 못찾으면 에러', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)

    await expect(ensureItemExists({ itemId: 'nonexistent' })).rejects.toThrow('품목명이 없습니다')
  })

  it('새 품목 자동 생성', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({ lastSeq: 1 })
    mockCreate.mockResolvedValue({ id: 'new-item-id' })

    const result = await ensureItemExists({
      itemName: '새품목',
      unit: 'KG',
      standardPrice: 5000,
    })
    expect(result).toBe('new-item-id')
    expect(mockCreate).toHaveBeenCalled()
  })

  it('동시성 충돌 시 기존 레코드 재조회', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst
      .mockResolvedValueOnce(null) // itemName 검색
      .mockResolvedValueOnce({ id: 'concurrent-item' }) // 충돌 후 재조회

    const uniqueError = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    mockUpsert.mockResolvedValue({ lastSeq: 1 })
    mockCreate.mockRejectedValue(uniqueError)

    const result = await ensureItemExists({ itemName: '충돌품목' })
    expect(result).toBe('concurrent-item')
  })
})

describe('ensurePartnerExists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('입력이 모두 없으면 null 반환', async () => {
    const result = await ensurePartnerExists({})
    expect(result).toBeNull()
  })

  it('partnerId로 기존 거래처 반환', async () => {
    mockFindUnique.mockResolvedValue({ id: 'partner-123' })

    const result = await ensurePartnerExists({ partnerId: 'partner-123' })
    expect(result).toBe('partner-123')
  })

  it('partnerName으로 기존 거래처 검색', async () => {
    mockFindUnique.mockResolvedValue(null) // partnerId 검색 실패
    mockFindFirst.mockResolvedValue({ id: 'found-partner' })

    const result = await ensurePartnerExists({
      partnerId: 'nonexistent',
      partnerName: '테스트거래처',
    })
    expect(result).toBe('found-partner')
  })

  it('partnerName 없이 못찾으면 에러', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)

    await expect(ensurePartnerExists({ partnerId: 'nonexistent' })).rejects.toThrow('거래처명이 없습니다')
  })

  it('새 거래처 자동 생성', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({ lastSeq: 1 })
    mockCreate.mockResolvedValue({ id: 'new-partner-id' })

    const result = await ensurePartnerExists({
      partnerName: '새거래처',
      partnerType: 'SALES',
      bizNo: '123-45-67890',
    })
    expect(result).toBe('new-partner-id')
  })
})

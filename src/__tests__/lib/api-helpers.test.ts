import { describe, it, expect, vi } from 'vitest'

// next-auth → next/server 의존성을 모킹
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

import { getPaginationParams, buildMeta } from '@/lib/api-helpers'

describe('getPaginationParams', () => {
  it('기본값 반환 (page=1, pageSize=20)', () => {
    const sp = new URLSearchParams()
    const result = getPaginationParams(sp)
    expect(result).toEqual({ page: 1, pageSize: 20, skip: 0 })
  })

  it('유효한 값을 사용', () => {
    const sp = new URLSearchParams({ page: '3', pageSize: '50' })
    const result = getPaginationParams(sp)
    expect(result).toEqual({ page: 3, pageSize: 50, skip: 100 })
  })

  it('page 최소값 1 보장', () => {
    const sp = new URLSearchParams({ page: '-5' })
    const result = getPaginationParams(sp)
    expect(result.page).toBe(1)
    expect(result.skip).toBe(0)
  })

  it('page 0은 1로 보정', () => {
    const sp = new URLSearchParams({ page: '0' })
    const result = getPaginationParams(sp)
    expect(result.page).toBe(1)
  })

  it('pageSize 최대값 100 제한', () => {
    const sp = new URLSearchParams({ pageSize: '500' })
    const result = getPaginationParams(sp)
    expect(result.pageSize).toBe(100)
  })

  it('pageSize 최소값 1 보장', () => {
    const sp = new URLSearchParams({ pageSize: '0' })
    const result = getPaginationParams(sp)
    expect(result.pageSize).toBe(1)
  })

  it('NaN 입력은 기본값 사용', () => {
    const sp = new URLSearchParams({ page: 'abc', pageSize: 'xyz' })
    const result = getPaginationParams(sp)
    expect(result).toEqual({ page: 1, pageSize: 20, skip: 0 })
  })

  it('소수점 입력은 parseInt로 정수 변환', () => {
    const sp = new URLSearchParams({ page: '2.7', pageSize: '10.5' })
    const result = getPaginationParams(sp)
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(10)
  })

  it('skip이 올바르게 계산됨', () => {
    const sp = new URLSearchParams({ page: '5', pageSize: '25' })
    const result = getPaginationParams(sp)
    expect(result.skip).toBe(100) // (5-1) * 25
  })
})

describe('buildMeta', () => {
  it('올바른 메타 데이터 생성', () => {
    const meta = buildMeta(1, 20, 100)
    expect(meta).toEqual({
      page: 1,
      pageSize: 20,
      totalCount: 100,
      totalPages: 5,
    })
  })

  it('totalPages가 올림 계산됨', () => {
    const meta = buildMeta(1, 20, 55)
    expect(meta.totalPages).toBe(3) // ceil(55/20) = 3
  })

  it('totalCount가 0인 경우', () => {
    const meta = buildMeta(1, 20, 0)
    expect(meta.totalPages).toBe(0)
    expect(meta.totalCount).toBe(0)
  })

  it('totalCount가 pageSize와 같은 경우', () => {
    const meta = buildMeta(1, 20, 20)
    expect(meta.totalPages).toBe(1)
  })

  it('1개 레코드인 경우', () => {
    const meta = buildMeta(1, 20, 1)
    expect(meta.totalPages).toBe(1)
  })
})

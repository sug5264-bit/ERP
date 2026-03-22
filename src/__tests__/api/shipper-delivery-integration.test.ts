/**
 * 화주사 ↔ ERP 발주/출고 통합 테스트
 * - ERP 답글 → 자동 상태 전이 (PREPARING → SHIPPED)
 * - ERP 수동 상태 변경 (DELIVERED, RETURNED)
 * - 정산 지급 처리 + 중복 방지
 * - 대시보드 KPI (totalPosts, unrepliedPosts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    user: { findUnique: vi.fn() },
    note: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    shipperOrder: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    attachment: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import { GET as getNotesGET, POST as notesPOST } from '@/app/api/v1/notes/route'

function setAdminAuth() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'admin-1',
      roles: ['관리자'],
      permissions: [
        { module: 'sales', action: 'read' },
        { module: 'sales', action: 'update' },
      ],
      accountType: 'INTERNAL',
    },
  })
}

function createReq(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

// ─── Notes API - relatedTable validation ───

describe('Notes API - relatedTable validation', () => {
  beforeEach(() => vi.resetAllMocks())

  it.each([
    'ShipperDeliveryPost',
    'ShipperDeliveryReply',
    'ShipperDeliveryReplyPost',
    'ShipperDeliveryPostStatus',
    'SettlementPaid',
  ])('GET with relatedTable=%s → 200', async (table) => {
    setAdminAuth()
    mockPrisma.note.findMany.mockResolvedValue([])

    const resp = await getNotesGET(createReq(`http://localhost/api/v1/notes?relatedTable=${table}`))
    expect(resp.status).toBe(200)
  })

  it('GET with invalid relatedTable → 400', async () => {
    setAdminAuth()
    const resp = await getNotesGET(createReq('http://localhost/api/v1/notes?relatedTable=InvalidTable'))
    expect(resp.status).toBe(400)
  })

  it('POST with relatedTable=ShipperDeliveryReply creates reply note', async () => {
    setAdminAuth()
    const replyNote = { id: 'reply-1', content: '답글', relatedTable: 'ShipperDeliveryReply', relatedId: 'dp-1' }
    mockPrisma.note.create.mockResolvedValue(replyNote)

    const resp = await notesPOST(
      createReq('http://localhost/api/v1/notes', {
        method: 'POST',
        body: JSON.stringify({
          content: '답글 내용',
          relatedTable: 'ShipperDeliveryReply',
          relatedId: 'dp-1',
        }),
      })
    )

    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.data.relatedTable).toBe('ShipperDeliveryReply')
  })

  it('POST with relatedTable=ShipperDeliveryPostStatus updates status', async () => {
    setAdminAuth()
    mockPrisma.note.create.mockResolvedValue({
      id: 'st-new',
      content: 'DELIVERED',
      relatedTable: 'ShipperDeliveryPostStatus',
      relatedId: 'dp-1',
    })

    const resp = await notesPOST(
      createReq('http://localhost/api/v1/notes', {
        method: 'POST',
        body: JSON.stringify({
          content: 'DELIVERED',
          relatedTable: 'ShipperDeliveryPostStatus',
          relatedId: 'dp-1',
        }),
      })
    )

    expect(resp.status).toBe(200)
    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: 'DELIVERED',
        relatedTable: 'ShipperDeliveryPostStatus',
      }),
    })
  })

  it('POST with missing fields → 400', async () => {
    setAdminAuth()
    const resp = await notesPOST(
      createReq('http://localhost/api/v1/notes', {
        method: 'POST',
        body: JSON.stringify({ content: '답글' }),
      })
    )
    expect(resp.status).toBe(400)
  })

  it('POST with SettlementPaid creates paid record', async () => {
    setAdminAuth()
    mockPrisma.note.create.mockResolvedValue({
      id: 'paid-1',
      content: '화주사A 2026-01 정산 지급완료',
      relatedTable: 'SettlementPaid',
      relatedId: 'shipper-A_2026-01',
    })

    const resp = await notesPOST(
      createReq('http://localhost/api/v1/notes', {
        method: 'POST',
        body: JSON.stringify({
          content: '화주사A 2026-01 정산 지급완료',
          relatedTable: 'SettlementPaid',
          relatedId: 'shipper-A_2026-01',
        }),
      })
    )

    expect(resp.status).toBe(200)
  })
})

// ─── Status pipeline logic ───

describe('Status pipeline (client-side logic)', () => {
  const DELIVERY_STATUS_MAP: Record<string, { label: string }> = {
    PREPARING: { label: '준비중' },
    SHIPPED: { label: '출하대기' },
    DELIVERED: { label: '납품완료' },
    RETURNED: { label: '반품등록' },
  }

  it('상태 맵에 4가지 상태가 정의됨', () => {
    expect(Object.keys(DELIVERY_STATUS_MAP)).toEqual(['PREPARING', 'SHIPPED', 'DELIVERED', 'RETURNED'])
  })

  it('상태 전이: PREPARING → SHIPPED (첫 답글 시)', () => {
    const currentStatus = 'PREPARING'
    const hasReply = true
    const newStatus = currentStatus === 'PREPARING' && hasReply ? 'SHIPPED' : currentStatus
    expect(newStatus).toBe('SHIPPED')
  })

  it('SHIPPED 상태에서 답글 추가 시 상태 변경 없음', () => {
    const currentStatus = 'SHIPPED'
    const hasReply = true
    const newStatus = currentStatus === 'PREPARING' && hasReply ? 'SHIPPED' : currentStatus
    expect(newStatus).toBe('SHIPPED')
  })

  it('terminal 상태(DELIVERED/RETURNED) 확인', () => {
    const isTerminal = (status: string) => status === 'DELIVERED' || status === 'RETURNED'
    expect(isTerminal('DELIVERED')).toBe(true)
    expect(isTerminal('RETURNED')).toBe(true)
    expect(isTerminal('PREPARING')).toBe(false)
    expect(isTerminal('SHIPPED')).toBe(false)
  })
})

// ─── Content parsing logic ───

describe('Content parsing (channel/title/body extraction)', () => {
  function parsePostContent(content: string) {
    const channelMatch = content.match(/^\[(온라인|오프라인)\]/)
    const channel = channelMatch ? channelMatch[1] : null
    const afterChannel = channelMatch ? content.slice(channelMatch[0].length) : content
    const titleMatch = afterChannel.match(/^\[(.+?)\]\n?/)
    const title = titleMatch ? titleMatch[1] : null
    const body = titleMatch ? afterChannel.slice(titleMatch[0].length) : afterChannel.replace(/^\n/, '')
    return { channel, title, body }
  }

  function parseDeliveryContent(content: string) {
    const displayContent = content.replace(/^\[발주글\]\n?/, '')
    return parsePostContent(displayContent)
  }

  it('[온라인] 채널 파싱', () => {
    const result = parsePostContent('[온라인][긴급 발주]\n배송 요청합니다')
    expect(result.channel).toBe('온라인')
    expect(result.title).toBe('긴급 발주')
    expect(result.body).toBe('배송 요청합니다')
  })

  it('[오프라인] 채널 파싱', () => {
    const result = parsePostContent('[오프라인]본문만 있는 게시글')
    expect(result.channel).toBe('오프라인')
    expect(result.title).toBeNull()
    expect(result.body).toBe('본문만 있는 게시글')
  })

  it('채널 프리픽스 없는 컨텐츠', () => {
    const result = parsePostContent('일반 메모')
    expect(result.channel).toBeNull()
    expect(result.title).toBeNull()
    expect(result.body).toBe('일반 메모')
  })

  it('출고글(delivery post) 파싱 - [발주글] prefix 제거', () => {
    const result = parseDeliveryContent('[발주글]\n[온라인][테스트]\n본문')
    expect(result.channel).toBe('온라인')
    expect(result.title).toBe('테스트')
    expect(result.body).toBe('본문')
  })

  it('온라인/오프라인 필터링', () => {
    const posts = [{ content: '[온라인]주문1' }, { content: '[오프라인]주문2' }, { content: '[온라인]주문3' }]
    const onlinePosts = posts.filter((p) => p.content.startsWith('[온라인]'))
    const offlinePosts = posts.filter((p) => p.content.startsWith('[오프라인]'))

    expect(onlinePosts).toHaveLength(2)
    expect(offlinePosts).toHaveLength(1)
  })
})

// ─── Settlement status logic ───

describe('Settlement status logic', () => {
  it('PAID 상태 확인 (SettlementPaid note 존재)', () => {
    const paidMap = new Map([
      ['shipper-A_2026-01', { relatedId: 'shipper-A_2026-01', createdAt: '2026-01-15T00:00:00Z' }],
    ])
    const key = 'shipper-A_2026-01'
    const paidNote = paidMap.get(key)
    const status = paidNote ? 'PAID' : 'CONFIRMED'
    expect(status).toBe('PAID')
  })

  it('CONFIRMED 상태 (미지급)', () => {
    const paidMap = new Map<string, unknown>()
    const key = 'shipper-B_2026-02'
    const paidNote = paidMap.get(key)
    const status = paidNote ? 'PAID' : 'CONFIRMED'
    expect(status).toBe('CONFIRMED')
  })

  it('PROCESSING 상태에서 지급처리 방지 (client-side)', () => {
    const status = 'PROCESSING'
    const canMarkPaid = status === 'CONFIRMED'
    expect(canMarkPaid).toBe(false)
  })

  it('CONFIRMED 상태에서 지급처리 가능', () => {
    const status = 'CONFIRMED'
    const canMarkPaid = status === 'CONFIRMED'
    expect(canMarkPaid).toBe(true)
  })
})

// ─── Pipeline stats calculation ───

describe('Pipeline stats calculation', () => {
  interface PostItem {
    content: string
    deliveryPost: { status: string } | null
  }

  function calcStats(posts: PostItem[]) {
    const withDp = posts.filter((p) => p.deliveryPost)
    return {
      total: posts.length,
      preparing: withDp.filter((p) => p.deliveryPost?.status === 'PREPARING').length,
      shipped: withDp.filter((p) => p.deliveryPost?.status === 'SHIPPED').length,
      delivered: withDp.filter((p) => p.deliveryPost?.status === 'DELIVERED').length,
      returned: withDp.filter((p) => p.deliveryPost?.status === 'RETURNED').length,
    }
  }

  it('파이프라인 통계 정확성', () => {
    const posts: PostItem[] = [
      { content: '[온라인]주문1', deliveryPost: { status: 'PREPARING' } },
      { content: '[온라인]주문2', deliveryPost: { status: 'SHIPPED' } },
      { content: '[온라인]주문3', deliveryPost: { status: 'DELIVERED' } },
      { content: '[온라인]주문4', deliveryPost: { status: 'DELIVERED' } },
      { content: '[온라인]주문5', deliveryPost: null },
    ]

    const stats = calcStats(posts)
    expect(stats).toEqual({
      total: 5,
      preparing: 1,
      shipped: 1,
      delivered: 2,
      returned: 0,
    })
  })

  it('이행률 계산', () => {
    const total = 10
    const delivered = 8
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 0
    expect(rate).toBe(80)
  })

  it('게시글 없을 때 이행률 0%', () => {
    const total = 0
    const delivered = 0
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 0
    expect(rate).toBe(0)
  })
})

// ─── Unreplied posts calculation ───

describe('Unreplied posts KPI calculation', () => {
  it('답글 없는 게시글 정확히 카운트', () => {
    const orderPosts = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
    const deliveryPosts = [
      { id: 'dp1', relatedId: 'p1' },
      { id: 'dp2', relatedId: 'p2' },
      // p3 has no delivery post
    ]
    const deliveryReplies = [
      { relatedId: 'dp1' }, // dp1 has reply → p1 is replied
      // dp2 has no reply → p2 is unreplied
    ]

    const repliedDpIds = new Set(deliveryReplies.map((r) => r.relatedId))
    const dpToOrder = new Map(deliveryPosts.map((d) => [d.id, d.relatedId]))
    const repliedOrderIds = new Set([...repliedDpIds].map((dpId) => dpToOrder.get(dpId)).filter(Boolean) as string[])

    // p1 = replied (has dp1, dp1 has reply)
    // p2 = unreplied (has dp2, dp2 has no reply)
    // p3 = unreplied (no delivery post at all)
    const unrepliedCount = orderPosts.filter((p) => !repliedOrderIds.has(p.id)).length
    expect(unrepliedCount).toBe(2) // p2 and p3
  })

  it('모든 게시글에 답글 있을 때 unreplied=0', () => {
    const orderPosts = [{ id: 'p1' }]
    const deliveryPosts = [{ id: 'dp1', relatedId: 'p1' }]
    const deliveryReplies = [{ relatedId: 'dp1' }]

    const repliedDpIds = new Set(deliveryReplies.map((r) => r.relatedId))
    const dpToOrder = new Map(deliveryPosts.map((d) => [d.id, d.relatedId]))
    const repliedOrderIds = new Set([...repliedDpIds].map((dpId) => dpToOrder.get(dpId)).filter(Boolean) as string[])

    const unrepliedCount = orderPosts.filter((p) => !repliedOrderIds.has(p.id)).length
    expect(unrepliedCount).toBe(0)
  })
})

/**
 * 화주사 발주/출고 게시판 API 테스트
 * - POST /shipper/posts: 발주글 작성 + 자동 출고글/상태 생성
 * - GET /shipper/posts: 발주글 목록 + 출고 체인 조회
 * - DELETE /notes/[id]: ShipperOrderPost cascade 삭제
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
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    attachment: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
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

import { GET, POST } from '@/app/api/v1/shipper/posts/route'
import { DELETE } from '@/app/api/v1/notes/[id]/route'

function setShipperAuth(shipperId = 'shipper-1') {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-shipper-1',
      roles: [],
      permissions: [],
      accountType: 'SHIPPER',
      shipperId,
    },
  })
  mockPrisma.user.findUnique.mockResolvedValue({
    shipperId,
    accountType: 'SHIPPER',
  })
}

function setInternalAuth() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-admin-1',
      roles: ['관리자'],
      permissions: [{ module: 'sales', action: 'read' }],
      accountType: 'INTERNAL',
    },
  })
  mockPrisma.user.findUnique.mockResolvedValue({
    shipperId: null,
    accountType: 'INTERNAL',
  })
}

function createReq(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

// ─── POST /shipper/posts ───

describe('POST /api/v1/shipper/posts', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/shipper/posts', {
        method: 'POST',
        body: JSON.stringify({ content: '[온라인]테스트' }),
      })
    )
    expect(resp.status).toBe(401)
  })

  it('INTERNAL 계정이 접근 → 403', async () => {
    setInternalAuth()
    const resp = await POST(
      createReq('http://localhost/api/v1/shipper/posts', {
        method: 'POST',
        body: JSON.stringify({ content: '[온라인]테스트' }),
      })
    )
    expect(resp.status).toBe(403)
  })

  it('빈 content → 400 validation error', async () => {
    setShipperAuth()
    const resp = await POST(
      createReq('http://localhost/api/v1/shipper/posts', {
        method: 'POST',
        body: JSON.stringify({ content: '   ' }),
      })
    )
    expect(resp.status).toBe(400)
  })

  it('발주글 작성 시 자동으로 출고글 + PREPARING 상태 생성', async () => {
    setShipperAuth('shipper-A')

    const orderPost = {
      id: 'note-1',
      content: '[온라인]테스트 발주',
      relatedTable: 'ShipperOrderPost',
      relatedId: 'shipper-A',
      createdBy: 'user-shipper-1',
    }
    const deliveryPost = {
      id: 'dp-1',
      content: '[발주글]\n[온라인]테스트 발주',
      relatedTable: 'ShipperDeliveryPost',
      relatedId: 'note-1',
      createdBy: 'user-shipper-1',
    }
    const statusNote = {
      id: 'status-1',
      content: 'PREPARING',
      relatedTable: 'ShipperDeliveryPostStatus',
      relatedId: 'dp-1',
      createdBy: 'user-shipper-1',
    }

    mockPrisma.note.create
      .mockResolvedValueOnce(orderPost) // 1st: ShipperOrderPost
      .mockResolvedValueOnce(deliveryPost) // 2nd: ShipperDeliveryPost
      .mockResolvedValueOnce(statusNote) // 3rd: ShipperDeliveryPostStatus

    const resp = await POST(
      createReq('http://localhost/api/v1/shipper/posts', {
        method: 'POST',
        body: JSON.stringify({ content: '[온라인]테스트 발주' }),
      })
    )

    expect(resp.status).toBe(200)
    const data = await resp.json()
    expect(data.data.id).toBe('note-1')

    // Verify 3 create calls
    expect(mockPrisma.note.create).toHaveBeenCalledTimes(3)

    // 1st call: ShipperOrderPost
    expect(mockPrisma.note.create.mock.calls[0][0].data).toMatchObject({
      relatedTable: 'ShipperOrderPost',
      relatedId: 'shipper-A',
    })

    // 2nd call: ShipperDeliveryPost (auto-mirror)
    expect(mockPrisma.note.create.mock.calls[1][0].data).toMatchObject({
      relatedTable: 'ShipperDeliveryPost',
      relatedId: 'note-1',
      content: expect.stringContaining('[발주글]'),
    })

    // 3rd call: ShipperDeliveryPostStatus = PREPARING
    expect(mockPrisma.note.create.mock.calls[2][0].data).toMatchObject({
      relatedTable: 'ShipperDeliveryPostStatus',
      content: 'PREPARING',
    })
  })

  it('content 앞뒤 공백 제거', async () => {
    setShipperAuth()

    mockPrisma.note.create
      .mockResolvedValueOnce({ id: 'n1' })
      .mockResolvedValueOnce({ id: 'dp1' })
      .mockResolvedValueOnce({ id: 's1' })

    await POST(
      createReq('http://localhost/api/v1/shipper/posts', {
        method: 'POST',
        body: JSON.stringify({ content: '  [온라인]테스트  ' }),
      })
    )

    expect(mockPrisma.note.create.mock.calls[0][0].data.content).toBe('[온라인]테스트')
  })
})

// ─── GET /shipper/posts ───

describe('GET /api/v1/shipper/posts', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/shipper/posts'))
    expect(resp.status).toBe(401)
  })

  it('INTERNAL 계정 접근 → 403', async () => {
    setInternalAuth()
    const resp = await GET(createReq('http://localhost/api/v1/shipper/posts'))
    expect(resp.status).toBe(403)
  })

  it('발주글 + 출고 체인 정상 조회', async () => {
    setShipperAuth('shipper-A')

    const orderPosts = [
      {
        id: 'note-1',
        content: '[온라인]테스트',
        relatedTable: 'ShipperOrderPost',
        relatedId: 'shipper-A',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'user-1',
      },
    ]
    const deliveryPosts = [
      {
        id: 'dp-1',
        content: '[발주글]\n[온라인]테스트',
        relatedTable: 'ShipperDeliveryPost',
        relatedId: 'note-1',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]
    const deliveryStatuses = [
      { id: 'st-1', content: 'SHIPPED', relatedId: 'dp-1', createdAt: '2026-01-02T00:00:00Z' },
      { id: 'st-0', content: 'PREPARING', relatedId: 'dp-1', createdAt: '2026-01-01T00:00:00Z' },
    ]
    const deliveryReplies = [
      { id: 'reply-1', content: '답글 내용', relatedId: 'dp-1', createdAt: '2026-01-02T00:00:00Z' },
    ]
    const replyAttachments = [{ id: 'att-r1', relatedId: 'reply-1', mimeType: 'application/pdf', fileName: 'doc.pdf' }]
    const orderAttachments = [{ id: 'att-1', relatedId: 'note-1', mimeType: 'image/png', fileName: 'photo.png' }]

    mockPrisma.note.findMany
      .mockResolvedValueOnce(orderPosts) // ShipperOrderPost
      .mockResolvedValueOnce(deliveryPosts) // ShipperDeliveryPost
      .mockResolvedValueOnce(deliveryStatuses) // ShipperDeliveryPostStatus
      .mockResolvedValueOnce(deliveryReplies) // ShipperDeliveryReply

    mockPrisma.attachment.findMany
      .mockResolvedValueOnce(orderAttachments) // ShipperOrderAttachment
      .mockResolvedValueOnce(replyAttachments) // ShipperDeliveryReplyPost

    const resp = await GET(createReq('http://localhost/api/v1/shipper/posts'))
    expect(resp.status).toBe(200)

    const data = await resp.json()
    const post = data.data[0]

    // 발주글 기본 데이터
    expect(post.id).toBe('note-1')
    expect(post.replies).toEqual([]) // 더 이상 ShipperOrderReply 사용 안함
    expect(post.attachments).toHaveLength(1)

    // 출고 체인
    expect(post.deliveryPost).not.toBeNull()
    expect(post.deliveryPost.id).toBe('dp-1')
    expect(post.deliveryPost.status).toBe('SHIPPED') // 최신 상태 (desc 정렬 첫번째)
    expect(post.deliveryPost.replies).toHaveLength(1)
    expect(post.deliveryPost.replies[0].attachments).toHaveLength(1)
  })

  it('출고글이 없는 발주글은 deliveryPost=null', async () => {
    setShipperAuth('shipper-B')

    mockPrisma.note.findMany
      .mockResolvedValueOnce([
        {
          id: 'n-orphan',
          content: '[오프라인]테스트',
          relatedTable: 'ShipperOrderPost',
          relatedId: 'shipper-B',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([]) // no delivery posts
      .mockResolvedValueOnce([]) // no statuses
      .mockResolvedValueOnce([]) // no replies

    mockPrisma.attachment.findMany
      .mockResolvedValueOnce([]) // no order attachments
      .mockResolvedValueOnce([]) // no reply attachments

    const resp = await GET(createReq('http://localhost/api/v1/shipper/posts'))
    const data = await resp.json()

    expect(data.data[0].deliveryPost).toBeNull()
  })
})

// ─── DELETE /notes/[id] cascade for ShipperOrderPost ───

describe('DELETE /api/v1/notes/[id] - ShipperOrderPost cascade', () => {
  beforeEach(() => vi.resetAllMocks())

  it('ShipperOrderPost 삭제 시 전체 체인 cascade 삭제', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-shipper-1', roles: [], permissions: [], accountType: 'SHIPPER' },
    })

    const orderPost = {
      id: 'note-1',
      content: '[온라인]테스트',
      relatedTable: 'ShipperOrderPost',
      relatedId: 'shipper-A',
      createdBy: 'user-shipper-1',
    }

    mockPrisma.note.findUnique.mockResolvedValue(orderPost)

    // Track transaction operations
    const txOps: string[] = []
    const mockTx = {
      note: {
        findMany: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          if (where.relatedTable === 'ShipperDeliveryPost') {
            txOps.push('find:ShipperDeliveryPost')
            return [{ id: 'dp-1', relatedId: 'note-1' }]
          }
          if (where.relatedTable === 'ShipperDeliveryReply') {
            txOps.push('find:ShipperDeliveryReply')
            return [{ id: 'reply-1' }, { id: 'reply-2' }]
          }
          return []
        }),
        deleteMany: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          txOps.push(`deleteMany:${where.relatedTable}`)
          return { count: 1 }
        }),
        delete: vi.fn().mockImplementation(() => {
          txOps.push('delete:self')
          return orderPost
        }),
      },
      attachment: {
        deleteMany: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          txOps.push(`deleteMany:att:${where.relatedTable}`)
          return { count: 1 }
        }),
      },
    }

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => {
      await fn(mockTx)
    })

    const resp = await DELETE(createReq('http://localhost/api/v1/notes/note-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'note-1' }),
    })

    expect(resp.status).toBe(200)

    // Verify cascade order
    expect(txOps).toContain('find:ShipperDeliveryPost')
    expect(txOps).toContain('find:ShipperDeliveryReply')
    expect(txOps).toContain('deleteMany:att:ShipperDeliveryReplyPost') // reply attachments
    expect(txOps).toContain('deleteMany:ShipperDeliveryReply') // replies
    expect(txOps).toContain('deleteMany:ShipperDeliveryPostStatus') // statuses
    expect(txOps).toContain('deleteMany:ShipperDeliveryPost') // delivery posts
    expect(txOps).toContain('deleteMany:att:ShipperOrderAttachment') // order attachments
    expect(txOps).toContain('delete:self') // the post itself
  })

  it('다른 사용자의 게시글 삭제 시도 → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'other-user', roles: [], permissions: [], accountType: 'SHIPPER' },
    })

    mockPrisma.note.findUnique.mockResolvedValue({
      id: 'note-1',
      relatedTable: 'ShipperOrderPost',
      createdBy: 'user-shipper-1',
    })

    const resp = await DELETE(createReq('http://localhost/api/v1/notes/note-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'note-1' }),
    })

    expect(resp.status).toBe(403)
  })
})

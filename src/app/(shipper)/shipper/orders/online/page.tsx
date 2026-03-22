'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import {
  Plus,
  Trash2,
  Send,
  Search,
  MessageSquare,
  Paperclip,
  FileImage,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  TrendingUp,
  Clock,
  Package,
  CheckCircle2,
  ShoppingCart,
  X,
  CornerDownRight,
} from 'lucide-react'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'

// ── Types ──
interface NoteItem {
  id: string
  content: string
  relatedId: string
  createdBy?: string
  createdAt: string
}

interface AttachmentItem {
  id: string
  relatedId: string
  mimeType: string
  fileName: string
  fileSize?: number
}

interface DeliveryReplyItem extends NoteItem {
  attachments: AttachmentItem[]
}

interface PostItem extends NoteItem {
  replies: NoteItem[]
  attachments: AttachmentItem[]
  deliveryPost: {
    id: string
    content: string
    relatedId: string
    createdAt: string
    status: string
    replies: DeliveryReplyItem[]
  } | null
}

// ── Helpers ──
const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp,.zip,.rar,.7z'

const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PREPARING: { label: '준비중', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  SHIPPED: { label: '출하대기', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  DELIVERED: { label: '납품완료', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  RETURNED: { label: '반품등록', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('text') ||
    mimeType.includes('word') ||
    mimeType.includes('document')
  )
    return FileText
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet
  return FileIcon
}

function getFileTypeBadge(mimeType: string, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (mimeType.includes('pdf') || ext === 'pdf')
    return { label: 'PDF', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
  if (mimeType.includes('sheet') || mimeType.includes('excel') || ['xlsx', 'xls', 'csv'].includes(ext))
    return { label: 'Excel', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
  if (mimeType.includes('word') || mimeType.includes('document') || ['doc', 'docx'].includes(ext))
    return { label: 'Word', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
  if (mimeType.startsWith('image/'))
    return { label: '이미지', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' }
  return { label: ext.toUpperCase() || '파일', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' }
}

function FileAttachments({ files }: { files: AttachmentItem[] }) {
  if (files.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((att) => {
        const Icon = getFileIcon(att.mimeType)
        const typeBadge = getFileTypeBadge(att.mimeType, att.fileName)
        return (
          <button
            key={att.id}
            onClick={() => window.open(`/api/v1/attachments/${att.id}`, '_blank')}
            className="bg-muted/50 hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="max-w-[120px] truncate">{att.fileName}</span>
            <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${typeBadge.color}`}>{typeBadge.label}</span>
            <Download className="text-muted-foreground h-3 w-3" />
          </button>
        )
      })}
    </div>
  )
}

// ── 발주관리 탭 ──
function OrdersTab({ posts, onRefresh }: { posts: PostItem[]; onRefresh: () => void }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postContent, setPostContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filtered = posts.filter((n) => {
    if (startDate || endDate) {
      const d = n.createdAt?.split('T')[0] || ''
      if (startDate && d < startDate) return false
      if (endDate && d > endDate) return false
    }
    if (searchKeyword) {
      return n.content.toLowerCase().includes(searchKeyword.toLowerCase())
    }
    return true
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setPendingFiles((prev) => [...prev, ...Array.from(files)])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!postContent.trim()) {
      toast.error('내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const titlePart = postTitle ? `[${postTitle}]\n` : ''
      const content = `[온라인]${titlePart}${postContent.trim()}`
      const result = await api.post('/shipper/posts', { content })
      const noteId = result?.data?.id

      if (pendingFiles.length > 0 && noteId) {
        for (const file of pendingFiles) {
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('relatedTable', 'ShipperOrderAttachment')
            fd.append('relatedId', noteId)
            await api.upload('/attachments', fd)
          } catch {
            toast.error(`"${file.name}" 업로드 실패`)
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['shipper-posts'] })
      onRefresh()
      setPostTitle('')
      setPostContent('')
      setPendingFiles([])
      setWriteOpen(false)
      toast.success('발주 게시글이 등록되었습니다.')
    } catch {
      toast.error('게시글 등록에 실패했습니다.')
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notes/${id}`)
      onRefresh()
      toast.success('게시글이 삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={writeOpen} onOpenChange={setWriteOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> 발주 글쓰기
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>발주 게시글 작성</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">제목</label>
                <Input placeholder="제목 (선택사항)" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">내용 *</label>
                <Textarea
                  placeholder="발주 내용을 입력하세요..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="mr-1 h-3 w-3" /> 파일 첨부
                  </Button>
                  <span className="text-muted-foreground text-[10px]">PDF, Excel, Word, 이미지 등 (최대 50MB)</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pendingFiles.map((f, idx) => (
                      <span key={idx} className="bg-muted flex items-center gap-1 rounded px-2 py-1 text-xs">
                        {f.name}
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-destructive ml-1"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSubmit} disabled={!postContent.trim() || submitting} size="sm">
                  <Send className="mr-1 h-3.5 w-3.5" /> {submitting ? '등록 중...' : '등록'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
        <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="검색..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
        <Badge variant="secondary" className="ml-auto">
          {filtered.length}건
        </Badge>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <MessageSquare className="mb-2 h-8 w-8" />
            <p className="text-sm">등록된 발주 게시글이 없습니다.</p>
            <p className="mt-1 text-xs">글쓰기 버튼으로 새 발주를 작성하세요.</p>
          </div>
        )}
        {filtered.map((note, idx) => {
          const postNo = filtered.length - idx
          const isExpanded = expandedId === note.id
          const channelMatch = note.content.match(/^\[(온라인|오프라인)\]/)
          const afterChannel = channelMatch ? note.content.slice(channelMatch[0].length) : note.content
          const titleMatch = afterChannel.match(/^\[(.+?)\]\n?/)
          const title = titleMatch ? titleMatch[1] : null
          const body = titleMatch ? afterChannel.slice(titleMatch[0].length) : afterChannel.replace(/^\n/, '')
          const statusInfo = note.deliveryPost
            ? DELIVERY_STATUS_MAP[note.deliveryPost.status] || DELIVERY_STATUS_MAP.PREPARING
            : null

          return (
            <div key={note.id} className="overflow-hidden rounded-lg border transition-shadow hover:shadow-sm">
              <button
                type="button"
                className="hover:bg-muted/30 w-full px-4 py-3 text-left transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : note.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-medium">#{postNo}</span>
                      {statusInfo && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      )}
                      <Badge variant="default" className="text-[10px]">
                        온라인
                      </Badge>
                      {note.attachments.length > 0 && (
                        <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                          <Paperclip className="h-3 w-3" />
                          {note.attachments.length}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold">{title || body.slice(0, 60)}</p>
                    {title && <p className="text-muted-foreground mt-0.5 truncate text-xs">{body.slice(0, 80)}</p>}
                    <span className="text-muted-foreground mt-1 block text-[11px]">{formatDate(note.createdAt)}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronDown className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="space-y-3 border-t bg-white px-4 py-4 dark:bg-transparent">
                  <p className="text-sm break-all whitespace-pre-wrap">{body}</p>
                  <FileAttachments files={note.attachments} />
                  <div className="flex items-center justify-end border-t pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 gap-1 text-xs"
                      onClick={() => setDeleteTarget(note.id)}
                    >
                      <Trash2 className="h-3 w-3" /> 삭제
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="게시글 삭제"
        description="이 게시글을 삭제하시겠습니까?"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget)
        }}
        variant="destructive"
      />
    </div>
  )
}

// ── 출고관리 탭 ──
function DeliveriesTab({
  posts,
  statusFilter,
  onRefresh,
}: {
  posts: PostItem[]
  statusFilter: string | null
  onRefresh: () => void
}) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filtered = posts.filter((p) => {
    if (!p.deliveryPost) return false
    if (statusFilter && p.deliveryPost.status !== statusFilter) return false
    if (startDate || endDate) {
      const d = p.createdAt?.split('T')[0] || ''
      if (startDate && d < startDate) return false
      if (endDate && d > endDate) return false
    }
    if (searchKeyword) return p.content.toLowerCase().includes(searchKeyword.toLowerCase())
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {statusFilter && (
          <Badge variant="outline" className="text-xs">
            {DELIVERY_STATUS_MAP[statusFilter]?.label || statusFilter} 필터 적용 중
          </Badge>
        )}
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
        <div className="relative max-w-xs min-w-[120px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="h-8 pl-9 text-xs"
            placeholder="검색..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
        <Badge variant="secondary" className="ml-auto">
          {filtered.length}건
        </Badge>
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-xs">출고 게시글이 없습니다.</p>
      )}

      {filtered.map((post, idx) => {
        const dp = post.deliveryPost!
        const postNo = filtered.length - idx
        const displayContent = dp.content.replace(/^\[발주글\]\n?/, '')
        const channelMatch = displayContent.match(/^\[(온라인|오프라인)\]/)
        const afterChannel = channelMatch ? displayContent.slice(channelMatch[0].length) : displayContent
        const titleMatch = afterChannel.match(/^\[(.+?)\]\n?/)
        const title = titleMatch ? titleMatch[1] : null
        const body = titleMatch ? afterChannel.slice(titleMatch[0].length) : afterChannel.replace(/^\n/, '')
        const statusInfo = DELIVERY_STATUS_MAP[dp.status] || DELIVERY_STATUS_MAP.PREPARING

        return (
          <div key={dp.id} className="rounded-md border">
            <div className="px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium">#{postNo}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                >
                  {statusInfo.label}
                </span>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                >
                  발주
                </Badge>
                <span className="text-muted-foreground text-[10px]">{formatDate(dp.createdAt)}</span>
              </div>
              {title && <p className="text-sm font-medium">{title}</p>}
              <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">
                {body.slice(0, 200)}
                {body.length > 200 ? '...' : ''}
              </p>

              <FileAttachments files={post.attachments} />

              {/* 관리자 답글 (읽기 전용) */}
              {dp.replies.length > 0 && (
                <div className="mt-2 space-y-2 border-l-2 border-emerald-200 pl-4 dark:border-emerald-800">
                  {dp.replies.map((reply) => (
                    <div key={reply.id} className="rounded-md bg-emerald-50/50 px-3 py-2 dark:bg-emerald-950/30">
                      <div className="mb-1 flex items-center gap-2">
                        <CornerDownRight className="text-primary h-3 w-3" />
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          관리자 답변
                        </Badge>
                        <span className="text-muted-foreground text-[10px]">{formatDate(reply.createdAt)}</span>
                      </div>
                      <p className="text-xs whitespace-pre-wrap">{reply.content}</p>
                      {reply.attachments && <FileAttachments files={reply.attachments} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 메인 페이지 ──
export default function ShipperOnlineOrdersPage() {
  const [activeTab, setActiveTab] = useState('orders')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const { data: postsData, refetch } = useQuery({
    queryKey: ['shipper-posts'],
    queryFn: () => api.get('/shipper/posts'),
  })
  const posts: PostItem[] = useMemo(() => (postsData?.data || []) as PostItem[], [postsData])

  // Filter online only
  const onlinePosts = useMemo(() => posts.filter((p) => p.content.startsWith('[온라인]')), [posts])

  const stats = useMemo(() => {
    const withDp = onlinePosts.filter((p) => p.deliveryPost)
    const total = withDp.length
    const preparing = withDp.filter((p) => p.deliveryPost?.status === 'PREPARING').length
    const shipped = withDp.filter((p) => p.deliveryPost?.status === 'SHIPPED').length
    const delivered = withDp.filter((p) => p.deliveryPost?.status === 'DELIVERED').length
    const returned = withDp.filter((p) => p.deliveryPost?.status === 'RETURNED').length
    return { total: onlinePosts.length, preparing, shipped, delivered, returned }
  }, [onlinePosts])

  const handlePipelineClick = useCallback((status: string | null) => {
    if (status) {
      setActiveTab('deliveries')
      setStatusFilter((prev) => (prev === status ? null : status))
    } else {
      setActiveTab('orders')
      setStatusFilter(null)
    }
  }, [])

  const pipelineSteps = [
    { label: '발주 접수', count: stats.total, status: null, icon: ShoppingCart, color: 'blue' as const },
    { label: '준비중', count: stats.preparing, status: 'PREPARING', icon: Clock, color: 'amber' as const },
    { label: '출하대기', count: stats.shipped, status: 'SHIPPED', icon: Package, color: 'violet' as const },
    { label: '납품완료', count: stats.delivered, status: 'DELIVERED', icon: CheckCircle2, color: 'emerald' as const },
  ]

  const colorMap = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-200 dark:ring-blue-800',
      activeBg: 'bg-blue-100 dark:bg-blue-900',
      activeRing: 'ring-blue-500 dark:ring-blue-400',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-200 dark:ring-amber-800',
      activeBg: 'bg-amber-100 dark:bg-amber-900',
      activeRing: 'ring-amber-500 dark:ring-amber-400',
    },
    violet: {
      bg: 'bg-violet-50 dark:bg-violet-950',
      text: 'text-violet-600 dark:text-violet-400',
      ring: 'ring-violet-200 dark:ring-violet-800',
      activeBg: 'bg-violet-100 dark:bg-violet-900',
      activeRing: 'ring-violet-500 dark:ring-violet-400',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-200 dark:ring-emerald-800',
      activeBg: 'bg-emerald-100 dark:bg-emerald-900',
      activeRing: 'ring-emerald-500 dark:ring-emerald-400',
    },
  }

  const fulfillmentRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0

  return (
    <ShipperLayoutShell>
      <div className="space-y-6">
        <PageHeader title="온라인 주문 (발주/출고)" description="발주 게시글을 작성하고 출고 현황을 확인합니다" />

        {/* Pipeline */}
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-xs font-medium">처리 현황</span>
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter(null)}
                    className="text-muted-foreground hover:text-foreground ml-1 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors"
                  >
                    <X className="h-3 w-3" /> 필터 해제
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">이행률</span>
                <Badge
                  variant={fulfillmentRate >= 80 ? 'default' : fulfillmentRate >= 50 ? 'secondary' : 'outline'}
                  className="text-xs tabular-nums"
                >
                  {fulfillmentRate}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto sm:gap-0">
              {pipelineSteps.map((step, idx) => {
                const colors = colorMap[step.color]
                const Icon = step.icon
                const isActive =
                  step.status === null ? activeTab === 'orders' && !statusFilter : statusFilter === step.status
                return (
                  <div key={step.label} className="flex min-w-0 flex-1 items-center">
                    <button
                      type="button"
                      onClick={() => handlePipelineClick(step.status)}
                      className={`flex min-w-[72px] flex-1 flex-col items-center gap-1.5 rounded-lg py-2 transition-all sm:min-w-[96px] ${isActive ? 'bg-muted/60 scale-105 shadow-sm' : 'hover:bg-muted/30'}`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 transition-all sm:h-10 sm:w-10 ${isActive ? `${colors.activeBg} ${colors.activeRing} scale-110 shadow-md` : `${colors.bg} ${colors.ring}`}`}
                      >
                        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.text}`} />
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-[10px] leading-tight font-medium sm:text-xs ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {step.label}
                        </p>
                        <p
                          className={`mt-0.5 text-sm font-bold tabular-nums sm:text-base ${isActive ? 'text-foreground' : ''}`}
                        >
                          {step.count}
                          <span className="text-muted-foreground text-[10px] font-normal">건</span>
                        </p>
                      </div>
                    </button>
                    {idx < pipelineSteps.length - 1 && (
                      <ArrowRight className="text-muted-foreground/40 mx-0.5 h-4 w-4 shrink-0 sm:mx-1" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4">
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: `${fulfillmentRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v)
            if (v === 'orders') setStatusFilter(null)
          }}
        >
          <TabsList>
            <TabsTrigger value="orders">발주관리</TabsTrigger>
            <TabsTrigger value="deliveries">출고관리</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-4">
            <OrdersTab posts={onlinePosts} onRefresh={refetch} />
          </TabsContent>
          <TabsContent value="deliveries" className="mt-4">
            <DeliveriesTab posts={onlinePosts} statusFilter={statusFilter} onRefresh={refetch} />
          </TabsContent>
        </Tabs>
      </div>
    </ShipperLayoutShell>
  )
}

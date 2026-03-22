'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import {
  Trash2,
  Send,
  Search,
  MessageSquare,
  CornerDownRight,
  FileImage,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Reply,
  Paperclip,
  MoreHorizontal,
  PackageCheck,
  RotateCcw,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

// ── Types ──
interface ShipperItem {
  id: string
  companyCode: string
  companyName: string
}

interface NoteItem {
  id: string
  content: string
  relatedId: string
  createdBy: string
  createdAt: string
}

interface AttachmentItem {
  id: string
  relatedId: string
  mimeType: string
  fileName: string
}

// ── Helpers ──
const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PREPARING: { label: '준비중', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  SHIPPED: { label: '출하대기', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  DELIVERED: { label: '납품완료', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  RETURNED: { label: '반품등록', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp,.zip,.rar,.7z'

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

// ── 발주관리 탭 (읽기 전용) ──
function OrdersTab({
  shippers,
  selectedShipperId,
  notes,
  attachments,
}: {
  shippers: ShipperItem[]
  selectedShipperId: string
  notes: NoteItem[]
  attachments: AttachmentItem[]
}) {
  const shipperMap = new Map(shippers.map((s) => [s.id, s]))
  const getPostAttachments = (noteId: string) => attachments.filter((a) => a.relatedId === noteId)

  const filtered = selectedShipperId !== 'all' ? notes.filter((n) => n.relatedId === selectedShipperId) : notes

  return (
    <div className="space-y-3">
      {filtered.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <MessageSquare className="mb-2 h-8 w-8" />
          <p className="text-sm">작성된 발주 게시글이 없습니다.</p>
        </div>
      ) : (
        filtered.map((note) => {
          const shipper = shipperMap.get(note.relatedId)
          const postFiles = getPostAttachments(note.id)
          const content = note.content
          const channelMatch = content.match(/^\[(온라인|오프라인)\]/)
          const afterChannel = channelMatch ? content.slice(channelMatch[0].length) : content
          const titleMatch = afterChannel.match(/^\[(.+?)\]\n?/)
          const title = titleMatch ? titleMatch[1] : null
          const body = titleMatch ? afterChannel.slice(titleMatch[0].length) : afterChannel.replace(/^\n/, '')

          return (
            <div key={note.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {shipper ? `[${shipper.companyCode}] ${shipper.companyName}` : note.relatedId.slice(-6)}
                    </Badge>
                    {channelMatch && (
                      <Badge variant={channelMatch[1] === '온라인' ? 'default' : 'secondary'} className="text-[10px]">
                        {channelMatch[1]}
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs">{formatDate(note.createdAt)}</span>
                  </div>
                  {title && <p className="text-sm font-medium">{title}</p>}
                  <p className="text-sm break-all whitespace-pre-wrap">{body}</p>
                </div>
              </div>
              {postFiles.length > 0 && <FileAttachments files={postFiles} />}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── 출고관리 탭 (답글/상태 변경) ──
function DeliveriesTab({
  shippers,
  selectedShipperId,
  notes,
  attachments,
}: {
  shippers: ShipperItem[]
  selectedShipperId: string
  notes: NoteItem[]
  attachments: AttachmentItem[]
}) {
  const queryClient = useQueryClient()
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const shipperMap = new Map(shippers.map((s) => [s.id, s]))

  // Fetch delivery posts
  const { data: dpData } = useQuery({
    queryKey: ['shipper-delivery-posts'],
    queryFn: () => api.get('/notes?relatedTable=ShipperDeliveryPost'),
  })
  const deliveryPosts: NoteItem[] = dpData?.data || []

  // Fetch statuses
  const { data: statusData } = useQuery({
    queryKey: ['shipper-delivery-statuses'],
    queryFn: () => api.get('/notes?relatedTable=ShipperDeliveryPostStatus'),
  })
  const statuses: NoteItem[] = statusData?.data || []

  // Fetch replies
  const { data: repliesData } = useQuery({
    queryKey: ['shipper-delivery-replies'],
    queryFn: () => api.get('/notes?relatedTable=ShipperDeliveryReply'),
  })
  const replies: NoteItem[] = repliesData?.data || []

  // Fetch reply attachments
  const { data: replyAttsData } = useQuery({
    queryKey: ['shipper-delivery-reply-attachments'],
    queryFn: () => api.get('/attachments?relatedTable=ShipperDeliveryReplyPost'),
  })
  const replyAttachments: AttachmentItem[] = replyAttsData?.data || []

  const getStatus = (dpId: string) => {
    const s = statuses.filter((st) => st.relatedId === dpId)
    return s.length > 0 ? s[0].content : 'PREPARING'
  }

  const getReplies = (dpId: string) => replies.filter((r) => r.relatedId === dpId)
  const getReplyAtts = (replyId: string) => replyAttachments.filter((a) => a.relatedId === replyId)
  const getPostAttachments = (noteId: string) => attachments.filter((a) => a.relatedId === noteId)

  // Map note IDs to their delivery posts
  const noteIdToDp = new Map(deliveryPosts.map((dp) => [dp.relatedId, dp]))

  const filteredNotes = (
    selectedShipperId !== 'all' ? notes.filter((n) => n.relatedId === selectedShipperId) : notes
  ).filter((n) => noteIdToDp.has(n.id))

  const updateStatus = async (dpId: string, status: string) => {
    try {
      await api.post('/notes', { content: status, relatedTable: 'ShipperDeliveryPostStatus', relatedId: dpId })
      queryClient.invalidateQueries({ queryKey: ['shipper-delivery-statuses'] })
      toast.success(`${DELIVERY_STATUS_MAP[status]?.label || status} 처리되었습니다.`)
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  const handleReply = async (dpId: string) => {
    if (!replyContent.trim()) {
      toast.error('내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const result = await api.post('/notes', {
        content: replyContent.trim(),
        relatedTable: 'ShipperDeliveryReply',
        relatedId: dpId,
      })
      const replyId = result?.data?.id

      if (replyFiles.length > 0 && replyId) {
        for (const file of replyFiles) {
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('relatedTable', 'ShipperDeliveryReplyPost')
            fd.append('relatedId', replyId)
            await api.upload('/attachments', fd)
          } catch {
            toast.error(`"${file.name}" 업로드 실패`)
          }
        }
      }

      // Auto-transition PREPARING → SHIPPED
      const currentStatus = getStatus(dpId)
      if (currentStatus === 'PREPARING') {
        await updateStatus(dpId, 'SHIPPED')
      }

      queryClient.invalidateQueries({ queryKey: ['shipper-delivery-replies'] })
      queryClient.invalidateQueries({ queryKey: ['shipper-delivery-reply-attachments'] })
      setReplyContent('')
      setReplyFiles([])
      setReplyTargetId(null)
      toast.success('답글이 등록되었습니다.')
    } catch {
      toast.error('답글 등록에 실패했습니다.')
    }
    setSubmitting(false)
  }

  const handleDeleteReply = async (id: string) => {
    try {
      await api.delete(`/notes/${id}`)
      queryClient.invalidateQueries({ queryKey: ['shipper-delivery-replies'] })
      toast.success('답글이 삭제되었습니다.')
    } catch {
      toast.error('답글 삭제에 실패했습니다.')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-3">
      {filteredNotes.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">출고 게시글이 없습니다.</p>
      ) : (
        filteredNotes.map((note) => {
          const dp = noteIdToDp.get(note.id)!
          const shipper = shipperMap.get(note.relatedId)
          const dpStatus = getStatus(dp.id)
          const statusInfo = DELIVERY_STATUS_MAP[dpStatus] || DELIVERY_STATUS_MAP.PREPARING
          const dpReplies = getReplies(dp.id)
          const noteFiles = getPostAttachments(note.id)
          const isTerminal = dpStatus === 'DELIVERED' || dpStatus === 'RETURNED'

          const displayContent = dp.content.replace(/^\[발주글\]\n?/, '')
          const channelMatch = displayContent.match(/^\[(온라인|오프라인)\]/)
          const afterChannel = channelMatch ? displayContent.slice(channelMatch[0].length) : displayContent
          const titleMatch = afterChannel.match(/^\[(.+?)\]\n?/)
          const title = titleMatch ? titleMatch[1] : null
          const body = titleMatch ? afterChannel.slice(titleMatch[0].length) : afterChannel.replace(/^\n/, '')

          return (
            <div key={dp.id} className="rounded-md border">
              <div className="px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {shipper ? `[${shipper.companyCode}] ${shipper.companyName}` : note.relatedId.slice(-6)}
                    </Badge>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    {channelMatch && (
                      <Badge variant={channelMatch[1] === '온라인' ? 'default' : 'secondary'} className="text-[10px]">
                        {channelMatch[1]}
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-[10px]">{formatDate(dp.createdAt)}</span>
                  </div>
                  {!isTerminal && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateStatus(dp.id, 'DELIVERED')}>
                          <PackageCheck className="mr-2 h-4 w-4 text-green-600" /> 납품완료
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(dp.id, 'RETURNED')}>
                          <RotateCcw className="mr-2 h-4 w-4 text-red-600" /> 반품등록
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {title && <p className="text-sm font-medium">{title}</p>}
                <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">
                  {body.slice(0, 200)}
                  {body.length > 200 ? '...' : ''}
                </p>

                {noteFiles.length > 0 && (
                  <div className="mt-2">
                    <FileAttachments files={noteFiles} />
                  </div>
                )}

                {/* Replies */}
                {dpReplies.length > 0 && (
                  <div className="mt-2 space-y-2 border-l-2 border-emerald-200 pl-4 dark:border-emerald-800">
                    {dpReplies.map((reply) => {
                      const replyAtts = getReplyAtts(reply.id)
                      return (
                        <div key={reply.id} className="rounded-md bg-emerald-50/50 px-3 py-2 dark:bg-emerald-950/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              >
                                답글
                              </Badge>
                              <span className="text-muted-foreground text-[10px]">{formatDate(reply.createdAt)}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-5 w-5"
                              onClick={() => setDeleteTarget(reply.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs whitespace-pre-wrap">{reply.content}</p>
                          {replyAtts.length > 0 && (
                            <div className="mt-1">
                              <FileAttachments files={replyAtts} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Reply form */}
                {!isTerminal && (
                  <>
                    {replyTargetId === dp.id ? (
                      <div className="bg-muted/20 mt-2 space-y-2 rounded-md border p-3">
                        <Textarea
                          placeholder="답글을 입력하세요..."
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={3}
                          className="text-xs"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => replyFileInputRef.current?.click()}
                          >
                            <Paperclip className="mr-1 h-3 w-3" /> 파일 첨부
                          </Button>
                          <input
                            ref={replyFileInputRef}
                            type="file"
                            accept={ACCEPTED_TYPES}
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files) setReplyFiles((prev) => [...prev, ...Array.from(e.target.files!)])
                              if (replyFileInputRef.current) replyFileInputRef.current.value = ''
                            }}
                          />
                          {replyFiles.map((f, i) => (
                            <span
                              key={i}
                              className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                            >
                              <Paperclip className="h-2.5 w-2.5" /> {f.name}
                              <button
                                type="button"
                                onClick={() => setReplyFiles(replyFiles.filter((_, idx) => idx !== i))}
                                className="text-destructive ml-0.5"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setReplyTargetId(null)
                              setReplyContent('')
                              setReplyFiles([])
                            }}
                          >
                            취소
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleReply(dp.id)}
                            disabled={!replyContent.trim() || submitting}
                          >
                            <Send className="mr-1 h-3 w-3" /> {submitting ? '등록 중...' : '답글 등록'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 gap-1 text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => setReplyTargetId(dp.id)}
                      >
                        <Reply className="h-3 w-3" /> 답글 달기
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="답글 삭제"
        description="이 답글을 삭제하시겠습니까?"
        onConfirm={() => {
          if (deleteTarget) handleDeleteReply(deleteTarget)
        }}
        variant="destructive"
      />
    </div>
  )
}

// ── 메인 페이지 ──
export default function ThreePLOrderPostsPage() {
  const [selectedShipperId, setSelectedShipperId] = useState<string>('all')

  const { data: shippersData } = useQuery({
    queryKey: ['3pl-shippers-all'],
    queryFn: () => api.get('/sales/3pl/shippers?pageSize=500'),
    staleTime: 5 * 60 * 1000,
  })
  const shippers: ShipperItem[] = shippersData?.data || []

  const { data: notesData } = useQuery({
    queryKey: ['shipper-order-posts', selectedShipperId],
    queryFn: () => {
      const url =
        selectedShipperId !== 'all'
          ? `/notes?relatedTable=ShipperOrderPost&relatedId=${selectedShipperId}`
          : `/notes?relatedTable=ShipperOrderPost`
      return api.get(url)
    },
  })
  const notes: NoteItem[] = notesData?.data || []

  const { data: attachmentsData } = useQuery({
    queryKey: ['shipper-order-attachments'],
    queryFn: () => api.get('/attachments?relatedTable=ShipperOrderAttachment'),
  })
  const allAttachments: AttachmentItem[] = attachmentsData?.data || []

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="발주/출고 게시판" description="화주사 발주 게시글 확인 및 출고 답글/상태 관리" />

      <div className="flex items-center gap-2">
        <Search className="text-muted-foreground h-4 w-4" />
        <Select value={selectedShipperId} onValueChange={setSelectedShipperId}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="전체 화주사" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 화주사</SelectItem>
            {shippers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                [{s.companyCode}] {s.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{notes.length}건</Badge>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">발주관리</TabsTrigger>
          <TabsTrigger value="deliveries">출고관리</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4">
          <OrdersTab
            shippers={shippers}
            selectedShipperId={selectedShipperId}
            notes={notes}
            attachments={allAttachments}
          />
        </TabsContent>
        <TabsContent value="deliveries" className="mt-4">
          <DeliveriesTab
            shippers={shippers}
            selectedShipperId={selectedShipperId}
            notes={notes}
            attachments={allAttachments}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

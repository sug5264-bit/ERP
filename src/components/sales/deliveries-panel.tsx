'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import {
  Paperclip,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  Reply,
  Search,
  FileImage,
  FileText as FileTextIcon,
  FileSpreadsheet as FileSpreadsheetIcon,
  File as FileIconGeneric,
  Download,
  Pencil,
  Trash2,
  X,
  Check,
  MoreHorizontal,
  PackageCheck,
  RotateCcw,
} from 'lucide-react'

function getDeliveryFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('text') ||
    mimeType.includes('word') ||
    mimeType.includes('document')
  )
    return FileTextIcon
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheetIcon
  return FileIconGeneric
}

function formatFileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function getDeliveryFileTypeBadge(mimeType: string, fileName: string) {
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

interface DeliveryNoteItem {
  id: string
  content: string
  relatedId: string
  createdBy?: string
  createdAt: string
}

interface DeliveryNoteAttachment {
  id: string
  relatedId: string
  mimeType: string
  fileName: string
  fileSize?: number
}

interface SalesOrderOption {
  id: string
  orderNo: string
  partner?: { partnerName: string }
}

const DELIVERY_ACCEPTED_TYPES =
  '.pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp,.zip,.rar,.7z'

const POST_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PREPARING: { label: '준비중', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  SHIPPED: { label: '출하대기', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  DELIVERED: { label: '납품완료', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  RETURNED: { label: '반품등록', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const RETURN_REASONS = [
  { value: 'DEFECT', label: '불량' },
  { value: 'WRONG_ITEM', label: '오배송' },
  { value: 'CUSTOMER_CHANGE', label: '고객변심' },
  { value: 'QUALITY_ISSUE', label: '품질문제' },
  { value: 'OTHER', label: '기타' },
]

function getLocalDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface DeliveriesPanelProps {
  statusFilter?: string | null
}

export function DeliveriesPanel({ statusFilter }: DeliveriesPanelProps) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  const [notesExpanded, setNotesExpanded] = useState(true)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [noteSearchKeyword, setNoteSearchKeyword] = useState('')
  const [noteStartDate, setNoteStartDate] = useState('')
  const [noteEndDate, setNoteEndDate] = useState('')
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editingReplyContent, setEditingReplyContent] = useState('')
  // Return registration dialog
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [returnTargetNoteId, setReturnTargetNoteId] = useState<string | null>(null)
  const [returnReason, setReturnReason] = useState('OTHER')
  const [returnReasonDetail, setReturnReasonDetail] = useState('')
  const [returnAmount, setReturnAmount] = useState('')
  const [returnDate, setReturnDate] = useState(getLocalDateString())
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // ── Queries ──
  const { data: deliveryNotesData } = useQuery({
    queryKey: ['notes', 'DeliveryPost'],
    queryFn: () => api.get('/notes?relatedTable=DeliveryPost') as Promise<{ data: DeliveryNoteItem[] }>,
  })
  const deliveryNotes: DeliveryNoteItem[] = deliveryNotesData?.data || []

  const { data: deliveryRepliesData } = useQuery({
    queryKey: ['notes', 'DeliveryReply'],
    queryFn: () => api.get('/notes?relatedTable=DeliveryReply') as Promise<{ data: DeliveryNoteItem[] }>,
  })
  const deliveryReplies: DeliveryNoteItem[] = deliveryRepliesData?.data || []

  const { data: replyAttachmentsData } = useQuery({
    queryKey: ['attachments', 'DeliveryReplyPost'],
    queryFn: () =>
      api.get('/attachments?relatedTable=DeliveryReplyPost') as Promise<{ data: DeliveryNoteAttachment[] }>,
  })
  const replyAttachments: DeliveryNoteAttachment[] = replyAttachmentsData?.data || []

  // Fetch original SalesOrderPost attachments (uploaded in 수주관리)
  const { data: postAttachmentsData } = useQuery({
    queryKey: ['attachments', 'SalesOrderPost'],
    queryFn: () => api.get('/attachments?relatedTable=SalesOrderPost') as Promise<{ data: DeliveryNoteAttachment[] }>,
  })
  const postAttachments: DeliveryNoteAttachment[] = postAttachmentsData?.data || []

  // Status tracking per DeliveryPost
  const { data: statusNotesData } = useQuery({
    queryKey: ['notes', 'DeliveryPostStatus'],
    queryFn: () => api.get('/notes?relatedTable=DeliveryPostStatus') as Promise<{ data: DeliveryNoteItem[] }>,
  })
  const statusNotes: DeliveryNoteItem[] = statusNotesData?.data || []

  // For return registration - need sales orders
  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-for-return'],
    queryFn: () => api.get('/sales/orders?pageSize=200') as Promise<{ data: SalesOrderOption[] }>,
    staleTime: 5 * 60 * 1000,
  })
  const orders: SalesOrderOption[] = ordersData?.data || []

  const getRepliesForNote = (noteId: string) => deliveryReplies.filter((r) => r.relatedId === noteId)
  const getReplyAttachments = (replyId: string) => replyAttachments.filter((a) => a.relatedId === replyId)
  const getPostAttachments = (noteRelatedId: string) => postAttachments.filter((a) => a.relatedId === noteRelatedId)

  // Get latest status for a DeliveryPost note (newest status note wins)
  const getPostStatus = (noteId: string): string => {
    const statuses = statusNotes.filter((s) => s.relatedId === noteId)
    if (statuses.length === 0) return 'PREPARING'
    // statusNotes are sorted by createdAt desc, so first is newest
    return statuses[0].content || 'PREPARING'
  }

  const filteredDeliveryNotes = deliveryNotes.filter((n) => {
    // Pipeline status filter from parent
    if (statusFilter) {
      const postStatus = getPostStatus(n.id)
      if (postStatus !== statusFilter) return false
    }
    if (noteStartDate || noteEndDate) {
      const noteDate = n.createdAt?.split('T')[0] || ''
      if (noteStartDate && noteDate < noteStartDate) return false
      if (noteEndDate && noteDate > noteEndDate) return false
    }
    if (noteSearchKeyword) {
      if (!n.content.toLowerCase().includes(noteSearchKeyword.toLowerCase())) return false
    }
    return true
  })

  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setReplyFiles((prev) => [...prev, ...Array.from(files)])
    if (replyFileInputRef.current) replyFileInputRef.current.value = ''
  }

  const uploadFile = async (file: File, relatedTable: string, relatedId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('relatedTable', relatedTable)
    formData.append('relatedId', relatedId)
    return api.upload('/attachments', formData)
  }

  const updatePostStatus = async (noteId: string, status: string) => {
    try {
      await api.post('/notes', {
        content: status,
        relatedTable: 'DeliveryPostStatus',
        relatedId: noteId,
      })
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryPostStatus'] })
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  const handleSubmitReply = async (parentNoteId: string) => {
    if (!replyContent.trim()) {
      toast.error('답글 내용을 입력해주세요.')
      return
    }
    setReplySubmitting(true)
    try {
      const replyResult = await api.post('/notes', {
        content: replyContent.trim(),
        relatedTable: 'DeliveryReply',
        relatedId: parentNoteId,
      })
      const replyId = replyResult?.data?.id

      // Upload files
      if (replyFiles.length > 0 && replyId) {
        for (const file of replyFiles) {
          try {
            await uploadFile(file, 'DeliveryReplyPost', replyId)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : `"${file.name}" 업로드 실패`)
          }
        }
      }

      // Auto-transition: reply → SHIPPED (출하대기)
      const currentStatus = getPostStatus(parentNoteId)
      if (currentStatus === 'PREPARING') {
        await updatePostStatus(parentNoteId, 'SHIPPED')
      }

      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryReply'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'DeliveryReplyPost'] })
      setReplyContent('')
      setReplyFiles([])
      setReplyingTo(null)
      toast.success('답글이 등록되었습니다.')
    } catch {
      toast.error('답글 등록에 실패했습니다.')
    }
    setReplySubmitting(false)
  }

  const handleEditReply = async (replyId: string) => {
    if (!editingReplyContent.trim()) {
      toast.error('내용을 입력해주세요.')
      return
    }
    try {
      await api.patch(`/notes/${replyId}`, { content: editingReplyContent.trim() })
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryReply'] })
      setEditingReplyId(null)
      setEditingReplyContent('')
      toast.success('답글이 수정되었습니다.')
    } catch {
      toast.error('답글 수정에 실패했습니다.')
    }
  }

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('답글을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/notes/${replyId}`)
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryReply'] })
      toast.success('답글이 삭제되었습니다.')
    } catch {
      toast.error('답글 삭제에 실패했습니다.')
    }
  }

  const handleDeletePost = async (noteId: string) => {
    if (!confirm('이 게시글을 삭제하시겠습니까? 수주관리의 원글과 모든 답글이 함께 삭제됩니다.')) return
    try {
      await api.delete(`/notes/${noteId}`)
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryPost'] })
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryReply'] })
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryPostStatus'] })
      queryClient.invalidateQueries({ queryKey: ['notes', 'SalesOrder'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'SalesOrderPost'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'DeliveryReplyPost'] })
      toast.success('게시글이 삭제되었습니다.')
    } catch {
      toast.error('게시글 삭제에 실패했습니다.')
    }
  }

  const handleMarkDelivered = async (noteId: string) => {
    await updatePostStatus(noteId, 'DELIVERED')
    toast.success('납품완료 처리되었습니다.')
  }

  const openReturnDialog = (noteId: string) => {
    setReturnTargetNoteId(noteId)
    setReturnReason('OTHER')
    setReturnReasonDetail('')
    setReturnAmount('')
    setReturnDate(getLocalDateString())
    setReturnDialogOpen(true)
  }

  const handleSubmitReturn = async () => {
    if (!returnTargetNoteId) return

    // Find the original SalesOrder note ID from the DeliveryPost's relatedId
    const deliveryNote = deliveryNotes.find((n) => n.id === returnTargetNoteId)
    if (!deliveryNote) {
      toast.error('원본 글을 찾을 수 없습니다.')
      return
    }

    // The DeliveryPost's relatedId = original SalesOrder note's ID
    // We need to find which salesOrderId the original note was linked to
    // The SalesOrder note's relatedId = salesOrderId (or 'GENERAL')
    // For now, try to find the first matching order or use the first available order
    const salesOrderNote = await api.get(`/notes?relatedTable=SalesOrder&relatedId=GENERAL`).catch(() => null)
    const allSalesNotes = salesOrderNote?.data || []
    const originalNote = allSalesNotes.find((n: DeliveryNoteItem) => n.id === deliveryNote.relatedId)

    // Try to get the salesOrderId from the original note
    let salesOrderId = originalNote?.relatedId
    if (!salesOrderId || salesOrderId === 'GENERAL') {
      // Use the first available order
      if (orders.length > 0) {
        salesOrderId = orders[0].id
      } else {
        toast.error('연결된 수주를 찾을 수 없습니다.')
        return
      }
    }

    setReturnSubmitting(true)
    try {
      await api.post('/sales/returns', {
        salesOrderId,
        returnDate: returnDate,
        reason: returnReason,
        reasonDetail: returnReasonDetail || undefined,
        totalAmount: parseFloat(returnAmount) || 0,
      })

      // Update post status to RETURNED
      await updatePostStatus(returnTargetNoteId, 'RETURNED')

      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      setReturnDialogOpen(false)
      toast.success('반품이 등록되었습니다.')
    } catch {
      toast.error('반품 등록에 실패했습니다.')
    }
    setReturnSubmitting(false)
  }

  return (
    <div className="space-y-6">
      {/* ── 수주관리 글 연동 & 답글 섹션 ── */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setNotesExpanded(!notesExpanded)}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">수주관리 글 / 답글</span>
            <Badge variant="secondary" className="text-[10px]">
              {filteredDeliveryNotes.length}건
            </Badge>
          </div>
          {notesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {notesExpanded && (
          <div className="space-y-3 border-t px-4 py-3">
            {statusFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {POST_STATUS_MAP[statusFilter]?.label || statusFilter} 필터 적용 중
                </Badge>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                startDate={noteStartDate}
                endDate={noteEndDate}
                onDateChange={(s, e) => {
                  setNoteStartDate(s)
                  setNoteEndDate(e)
                }}
              />
              <div className="relative max-w-xs min-w-[120px] flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  className="h-8 pl-9 text-xs"
                  placeholder="글 검색..."
                  value={noteSearchKeyword}
                  onChange={(e) => setNoteSearchKeyword(e.target.value)}
                />
              </div>
            </div>
            {filteredDeliveryNotes.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-xs">수주관리에서 작성된 글이 없습니다.</p>
            )}
            {filteredDeliveryNotes.map((note, idx) => {
              const postNo = filteredDeliveryNotes.length - idx
              const displayContent = note.content.replace(/^\[수주글\]\n?/, '')
              const channelMatch = displayContent.match(/^\[(온라인|오프라인)\]/)
              const channelType = channelMatch ? channelMatch[1] : null
              const afterChannel = channelMatch ? displayContent.slice(channelMatch[0].length) : displayContent
              const titleMatch = afterChannel.match(/^\[(.+?)\]\n?/)
              const title = titleMatch ? titleMatch[1] : null
              const body = titleMatch ? afterChannel.slice(titleMatch[0].length) : afterChannel.replace(/^\n/, '')
              const replies = getRepliesForNote(note.id)
              const notePostFiles = getPostAttachments(note.relatedId)
              const postStatus = getPostStatus(note.id)
              const statusInfo = POST_STATUS_MAP[postStatus] || POST_STATUS_MAP.PREPARING
              const isTerminal = postStatus === 'DELIVERED' || postStatus === 'RETURNED'

              return (
                <div key={note.id} className="rounded-md border">
                  <div className="px-3 py-2.5">
                    {/* Header with status and more menu */}
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
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
                          수주
                        </Badge>
                        {channelType && (
                          <Badge variant={channelType === '온라인' ? 'default' : 'secondary'} className="text-[10px]">
                            {channelType}
                          </Badge>
                        )}
                        {notePostFiles.length > 0 && (
                          <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                            <Paperclip className="h-3 w-3" />
                            {notePostFiles.length}
                          </span>
                        )}
                        <span className="text-muted-foreground text-[10px]">{formatDate(note.createdAt)}</span>
                      </div>
                      {/* More menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!isTerminal && (
                            <>
                              <DropdownMenuItem onClick={() => handleMarkDelivered(note.id)}>
                                <PackageCheck className="mr-2 h-4 w-4 text-green-600" />
                                납품완료
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openReturnDialog(note.id)}>
                                <RotateCcw className="mr-2 h-4 w-4 text-red-600" />
                                반품등록
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => handleDeletePost(note.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {title && <p className="text-sm font-medium">{title}</p>}
                    <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">
                      {body.slice(0, 200)}
                      {body.length > 200 ? '...' : ''}
                    </p>

                    {/* Original post attachments from 수주관리 */}
                    {notePostFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-muted-foreground text-[10px] font-medium">첨부파일</p>
                        <div className="flex flex-wrap gap-1.5">
                          {notePostFiles.map((att) => {
                            const Icon = getDeliveryFileIcon(att.mimeType)
                            const typeBadge = getDeliveryFileTypeBadge(att.mimeType, att.fileName)
                            return (
                              <button
                                key={att.id}
                                onClick={() => window.open(`/api/v1/attachments/${att.id}`, '_blank')}
                                className="hover:bg-muted flex items-center gap-1 rounded border bg-white px-2 py-1 text-[10px] transition-colors dark:bg-transparent"
                              >
                                <Icon className="h-3 w-3" />
                                <span className="max-w-[120px] truncate">{att.fileName}</span>
                                {att.fileSize && (
                                  <span className="text-muted-foreground text-[9px]">
                                    ({formatFileSize(att.fileSize)})
                                  </span>
                                )}
                                <span className={`rounded px-0.5 text-[8px] font-medium ${typeBadge.color}`}>
                                  {typeBadge.label}
                                </span>
                                <Download className="h-2.5 w-2.5" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="mt-2 space-y-2 border-l-2 border-emerald-200 pl-4 dark:border-emerald-800">
                        {replies.map((reply) => {
                          const replyAtts = getReplyAttachments(reply.id)
                          const isOwner = currentUserId && reply.createdBy === currentUserId
                          const isEditing = editingReplyId === reply.id

                          return (
                            <div
                              key={reply.id}
                              className="rounded-md bg-emerald-50/50 px-3 py-2 dark:bg-emerald-950/30"
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  >
                                    답글
                                  </Badge>
                                  <span className="text-muted-foreground text-[10px]">
                                    {formatDate(reply.createdAt)}
                                  </span>
                                </div>
                                {isOwner && !isEditing && (
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => {
                                        setEditingReplyId(reply.id)
                                        setEditingReplyContent(reply.content)
                                      }}
                                      title="수정"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive h-5 w-5"
                                      onClick={() => handleDeleteReply(reply.id)}
                                      title="삭제"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingReplyContent}
                                    onChange={(e) => setEditingReplyContent(e.target.value)}
                                    rows={3}
                                    className="text-xs"
                                  />
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => {
                                        setEditingReplyId(null)
                                        setEditingReplyContent('')
                                      }}
                                    >
                                      <X className="mr-1 h-3 w-3" /> 취소
                                    </Button>
                                    <Button size="sm" className="h-6 text-xs" onClick={() => handleEditReply(reply.id)}>
                                      <Check className="mr-1 h-3 w-3" /> 저장
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs whitespace-pre-wrap">{reply.content}</p>
                              )}
                              {replyAtts.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {replyAtts.map((att) => {
                                    const Icon = getDeliveryFileIcon(att.mimeType)
                                    const typeBadge = getDeliveryFileTypeBadge(att.mimeType, att.fileName)
                                    return (
                                      <button
                                        key={att.id}
                                        onClick={() => window.open(`/api/v1/attachments/${att.id}`, '_blank')}
                                        className="hover:bg-muted flex items-center gap-1 rounded border bg-white px-2 py-1 text-[10px] transition-colors dark:bg-transparent"
                                      >
                                        <Icon className="h-3 w-3" />
                                        <span className="max-w-[120px] truncate">{att.fileName}</span>
                                        <span className={`rounded px-0.5 text-[8px] font-medium ${typeBadge.color}`}>
                                          {typeBadge.label}
                                        </span>
                                        <Download className="h-2.5 w-2.5" />
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Reply button / form */}
                    {!isTerminal && (
                      <>
                        {replyingTo === note.id ? (
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
                                accept={DELIVERY_ACCEPTED_TYPES}
                                multiple
                                className="hidden"
                                onChange={handleReplyFileSelect}
                              />
                              {replyFiles.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {replyFiles.map((f, fidx) => (
                                    <span
                                      key={fidx}
                                      className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                                    >
                                      <Paperclip className="h-2.5 w-2.5" /> {f.name}
                                      <button
                                        type="button"
                                        onClick={() => setReplyFiles(replyFiles.filter((_, i) => i !== fidx))}
                                        className="text-destructive ml-0.5"
                                      >
                                        &times;
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setReplyingTo(null)
                                  setReplyContent('')
                                  setReplyFiles([])
                                }}
                              >
                                취소
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleSubmitReply(note.id)}
                                disabled={!replyContent.trim() || replySubmitting}
                              >
                                <Send className="mr-1 h-3 w-3" /> {replySubmitting ? '등록 중...' : '답글 등록'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-6 gap-1 text-xs text-blue-600 hover:text-blue-700"
                            onClick={() => setReplyingTo(note.id)}
                          >
                            <Reply className="h-3 w-3" /> 답글 달기
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 반품등록 다이얼로그 ── */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>반품등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">반품일 *</label>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">반품사유 *</label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">반품금액</label>
              <Input
                type="number"
                placeholder="0"
                value={returnAmount}
                onChange={(e) => setReturnAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">상세 사유</label>
              <Textarea
                placeholder="반품 상세 사유를 입력하세요"
                value={returnReasonDetail}
                onChange={(e) => setReturnReasonDetail(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setReturnDialogOpen(false)}>
                취소
              </Button>
              <Button size="sm" onClick={handleSubmitReturn} disabled={returnSubmitting}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {returnSubmitting ? '등록 중...' : '반품 등록'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

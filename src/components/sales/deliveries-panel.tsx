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
import { DateRangeFilter } from '@/components/common/date-range-filter'
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
  Truck,
  PackageCheck,
} from 'lucide-react'

function getDeliveryFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('word') || mimeType.includes('document'))
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

interface DeliveryRow {
  id: string
  deliveryNo: string
  status: string
  orderConfirmed?: boolean
  shipmentCompleted?: boolean
  partner?: { partnerName: string }
  salesOrder?: { orderNo: string }
}

interface ApiListResponse<T> {
  data: T[]
}

const DELIVERY_ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp,.zip,.rar,.7z'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PREPARING: { label: '준비중', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  SHIPPED: { label: '출하대기', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  DELIVERED: { label: '납품완료', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
}

export function DeliveriesPanel() {
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
    queryFn: () => api.get('/attachments?relatedTable=DeliveryReplyPost') as Promise<{ data: DeliveryNoteAttachment[] }>,
  })
  const replyAttachments: DeliveryNoteAttachment[] = replyAttachmentsData?.data || []

  // Fetch original SalesOrderPost attachments (uploaded in 수주관리)
  const { data: postAttachmentsData } = useQuery({
    queryKey: ['attachments', 'SalesOrderPost'],
    queryFn: () => api.get('/attachments?relatedTable=SalesOrderPost') as Promise<{ data: DeliveryNoteAttachment[] }>,
  })
  const postAttachments: DeliveryNoteAttachment[] = postAttachmentsData?.data || []

  // Fetch deliveries for status management
  const { data: deliveriesData } = useQuery({
    queryKey: ['sales-deliveries-all'],
    queryFn: () => api.get('/sales/deliveries?pageSize=100') as Promise<ApiListResponse<DeliveryRow>>,
  })
  const deliveries: DeliveryRow[] = deliveriesData?.data || []
  const activeDeliveries = deliveries.filter((d) => d.status !== 'DELIVERED')

  const getRepliesForNote = (noteId: string) => deliveryReplies.filter((r) => r.relatedId === noteId)
  const getReplyAttachments = (replyId: string) => replyAttachments.filter((a) => a.relatedId === replyId)
  // DeliveryPost note's relatedId = original SalesOrder note's ID
  const getPostAttachments = (noteRelatedId: string) => postAttachments.filter((a) => a.relatedId === noteRelatedId)

  const filteredDeliveryNotes = deliveryNotes.filter((n) => {
    // Date filter
    if (noteStartDate || noteEndDate) {
      const noteDate = n.createdAt?.split('T')[0] || ''
      if (noteStartDate && noteDate < noteStartDate) return false
      if (noteEndDate && noteDate > noteEndDate) return false
    }
    // Search filter
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
    const res = await fetch('/api/v1/attachments', { method: 'POST', body: formData })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error?.message || `파일 업로드 실패: ${file.name}`)
    }
    return res.json()
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

  const handleStatusChange = async (deliveryId: string, newStatus: string) => {
    try {
      await api.patch(`/sales/deliveries/${deliveryId}`, {
        status: newStatus,
        ...(newStatus === 'DELIVERED' ? { shipmentCompleted: true } : {}),
      })
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries-all'] })
      const statusLabel = STATUS_MAP[newStatus]?.label || newStatus
      toast.success(`상태가 "${statusLabel}"(으)로 변경되었습니다.`)
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── 출하 상태 관리 ── */}
      {activeDeliveries.length > 0 && (
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Truck className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">출하 상태 관리</span>
            <Badge variant="secondary" className="text-[10px]">{activeDeliveries.length}건</Badge>
          </div>
          <div className="divide-y">
            {activeDeliveries.map((d) => {
              const st = STATUS_MAP[d.status] || STATUS_MAP.PREPARING
              return (
                <div key={d.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${st.color}`}>
                      {st.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.deliveryNo}</p>
                      <p className="text-muted-foreground text-[10px] truncate">
                        {d.partner?.partnerName || ''} {d.salesOrder?.orderNo ? `· ${d.salesOrder.orderNo}` : ''}
                      </p>
                    </div>
                  </div>
                  <Select
                    value={d.status}
                    onValueChange={(v) => handleStatusChange(d.id, v)}
                  >
                    <SelectTrigger className="h-7 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREPARING" disabled={d.status !== 'PREPARING'}>
                        준비중
                      </SelectItem>
                      <SelectItem value="SHIPPED" disabled={d.status === 'DELIVERED'}>
                        <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> 출하대기</span>
                      </SelectItem>
                      <SelectItem value="DELIVERED">
                        <span className="flex items-center gap-1"><PackageCheck className="h-3 w-3" /> 납품완료</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
            <Badge variant="secondary" className="text-[10px]">{filteredDeliveryNotes.length}건</Badge>
          </div>
          {notesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {notesExpanded && (
          <div className="border-t px-4 py-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                startDate={noteStartDate}
                endDate={noteEndDate}
                onDateChange={(s, e) => {
                  setNoteStartDate(s)
                  setNoteEndDate(e)
                }}
              />
              <div className="relative min-w-[120px] flex-1 max-w-xs">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  className="pl-9 h-8 text-xs"
                  placeholder="글 검색..."
                  value={noteSearchKeyword}
                  onChange={(e) => setNoteSearchKeyword(e.target.value)}
                />
              </div>
            </div>
            {filteredDeliveryNotes.length === 0 && (
              <p className="text-muted-foreground text-center text-xs py-6">수주관리에서 작성된 글이 없습니다.</p>
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

              return (
                <div key={note.id} className="rounded-md border">
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-muted-foreground text-xs font-medium">#{postNo}</span>
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">수주</Badge>
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
                    {title && <p className="text-sm font-medium">{title}</p>}
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{body.slice(0, 200)}{body.length > 200 ? '...' : ''}</p>

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
                                className="bg-white dark:bg-transparent flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                              >
                                <Icon className="h-3 w-3" />
                                <span className="max-w-[120px] truncate">{att.fileName}</span>
                                {att.fileSize && (
                                  <span className="text-muted-foreground text-[9px]">({formatFileSize(att.fileSize)})</span>
                                )}
                                <span className={`rounded px-0.5 text-[8px] font-medium ${typeBadge.color}`}>{typeBadge.label}</span>
                                <Download className="h-2.5 w-2.5" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="mt-2 space-y-2 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                        {replies.map((reply) => {
                          const replyAtts = getReplyAttachments(reply.id)
                          const isOwner = currentUserId && reply.createdBy === currentUserId
                          const isEditing = editingReplyId === reply.id

                          return (
                            <div key={reply.id} className="rounded-md bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">답글</Badge>
                                  <span className="text-muted-foreground text-[10px]">{formatDate(reply.createdAt)}</span>
                                </div>
                                {isOwner && !isEditing && (
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => { setEditingReplyId(reply.id); setEditingReplyContent(reply.content) }}
                                      title="수정"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-destructive hover:text-destructive"
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
                                  <div className="flex items-center gap-1 justify-end">
                                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditingReplyId(null); setEditingReplyContent('') }}>
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
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {replyAtts.map((att) => {
                                    const Icon = getDeliveryFileIcon(att.mimeType)
                                    const typeBadge = getDeliveryFileTypeBadge(att.mimeType, att.fileName)
                                    return (
                                      <button
                                        key={att.id}
                                        onClick={() => window.open(`/api/v1/attachments/${att.id}`, '_blank')}
                                        className="bg-white dark:bg-transparent flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                                      >
                                        <Icon className="h-3 w-3" />
                                        <span className="max-w-[120px] truncate">{att.fileName}</span>
                                        <span className={`rounded px-0.5 text-[8px] font-medium ${typeBadge.color}`}>{typeBadge.label}</span>
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
                    {replyingTo === note.id ? (
                      <div className="mt-2 space-y-2 rounded-md border bg-muted/20 p-3">
                        <Textarea
                          placeholder="답글을 입력하세요..."
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={3}
                          className="text-xs"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
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
                              {replyFiles.map((f, idx) => (
                                <span key={idx} className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]">
                                  <Paperclip className="h-2.5 w-2.5" /> {f.name}
                                  <button type="button" onClick={() => setReplyFiles(replyFiles.filter((_, i) => i !== idx))} className="text-destructive ml-0.5">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setReplyingTo(null); setReplyContent(''); setReplyFiles([]) }}>
                            취소
                          </Button>
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleSubmitReply(note.id)} disabled={!replyContent.trim() || replySubmitting}>
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

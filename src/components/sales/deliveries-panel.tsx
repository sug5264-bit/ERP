'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
} from 'lucide-react'

// File icon helpers for delivery notes
function getDeliveryFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('word') || mimeType.includes('document'))
    return FileTextIcon
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheetIcon
  return FileIconGeneric
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
  status: string
  orderConfirmed?: boolean
}

interface ApiListResponse<T> {
  data: T[]
}

const DELIVERY_ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp,.zip,.rar,.7z'

export function DeliveriesPanel() {
  // ── Notes/Reply state for linked order posts ──
  const [notesExpanded, setNotesExpanded] = useState(true)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [noteSearchKeyword, setNoteSearchKeyword] = useState('')
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // ── Fetch linked order notes (mirrored from 수주관리) and replies ──
  const { data: deliveryNotesData } = useQuery({
    queryKey: ['notes', 'DeliveryPost'],
    queryFn: () => api.get('/notes?relatedTable=DeliveryPost') as Promise<{ data: DeliveryNoteItem[] }>,
  })
  const deliveryNotes: DeliveryNoteItem[] = deliveryNotesData?.data || []

  // Fetch reply notes (답글)
  const { data: deliveryRepliesData } = useQuery({
    queryKey: ['notes', 'DeliveryReply'],
    queryFn: () => api.get('/notes?relatedTable=DeliveryReply') as Promise<{ data: DeliveryNoteItem[] }>,
  })
  const deliveryReplies: DeliveryNoteItem[] = deliveryRepliesData?.data || []

  // Fetch attachments for reply posts
  const { data: replyAttachmentsData } = useQuery({
    queryKey: ['attachments', 'DeliveryReplyPost'],
    queryFn: () => api.get('/attachments?relatedTable=DeliveryReplyPost') as Promise<{ data: DeliveryNoteAttachment[] }>,
  })
  const replyAttachments: DeliveryNoteAttachment[] = replyAttachmentsData?.data || []

  const getRepliesForNote = (noteId: string) => deliveryReplies.filter((r) => r.relatedId === noteId)
  const getReplyAttachments = (replyId: string) => replyAttachments.filter((a) => a.relatedId === replyId)

  // Filter notes by search
  const filteredDeliveryNotes = noteSearchKeyword
    ? deliveryNotes.filter((n) => n.content.toLowerCase().includes(noteSearchKeyword.toLowerCase()))
    : deliveryNotes

  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setReplyFiles((prev) => [...prev, ...Array.from(files)])
    if (replyFileInputRef.current) replyFileInputRef.current.value = ''
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
          const formData = new FormData()
          formData.append('file', file)
          formData.append('relatedTable', 'DeliveryReplyPost')
          formData.append('relatedId', replyId)
          await fetch('/api/v1/attachments', { method: 'POST', body: formData }).catch(() => {
            toast.error(`"${file.name}" 업로드 실패`)
          })
        }
      }

      // Auto-change related deliveries to ORDER_CONFIRMED (수주대기) status
      const allDeliveries = await api.get('/sales/deliveries?pageSize=50&status=PREPARING') as ApiListResponse<DeliveryRow>
      const preparingDeliveries = (allDeliveries?.data || []).filter(
        (d) => d.status === 'PREPARING' && !d.orderConfirmed
      )
      for (const d of preparingDeliveries.slice(0, 1)) {
        await api.patch(`/sales/deliveries/${d.id}`, {
          orderConfirmed: true,
          orderConfirmedAt: new Date().toISOString(),
        }).catch(() => {})
      }

      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryReply'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'DeliveryReplyPost'] })
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      setReplyContent('')
      setReplyFiles([])
      setReplyingTo(null)
      toast.success('답글이 등록되었습니다. 수주대기 상태로 변경되었습니다.')
    } catch {
      toast.error('답글 등록에 실패했습니다.')
    }
    setReplySubmitting(false)
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
            <Badge variant="secondary" className="text-[10px]">{filteredDeliveryNotes.length}건</Badge>
          </div>
          {notesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {notesExpanded && (
          <div className="border-t px-4 py-3 space-y-3">
            <div className="relative max-w-xs">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                className="pl-9 h-8 text-xs"
                placeholder="글 검색..."
                value={noteSearchKeyword}
                onChange={(e) => setNoteSearchKeyword(e.target.value)}
              />
            </div>
            {filteredDeliveryNotes.length === 0 && (
              <p className="text-muted-foreground text-center text-xs py-6">수주관리에서 작성된 글이 없습니다.</p>
            )}
            {filteredDeliveryNotes.map((note) => {
              // Parse content: remove [수주글] prefix
              const displayContent = note.content.replace(/^\[수주글\]\n?/, '')
              const channelMatch = displayContent.match(/^\[(온라인|오프라인)\]/)
              const channelType = channelMatch ? channelMatch[1] : null
              const afterChannel = channelMatch ? displayContent.slice(channelMatch[0].length) : displayContent
              const titleMatch = afterChannel.match(/^\[(.+?)\]\n?/)
              const title = titleMatch ? titleMatch[1] : null
              const body = titleMatch ? afterChannel.slice(titleMatch[0].length) : afterChannel.replace(/^\n/, '')
              const replies = getRepliesForNote(note.id)

              return (
                <div key={note.id} className="rounded-md border">
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">수주</Badge>
                      {channelType && (
                        <Badge variant={channelType === '온라인' ? 'default' : 'secondary'} className="text-[10px]">
                          {channelType}
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-[10px]">{formatDate(note.createdAt)}</span>
                    </div>
                    {title && <p className="text-sm font-medium">{title}</p>}
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{body.slice(0, 200)}{body.length > 200 ? '...' : ''}</p>

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="mt-2 space-y-2 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                        {replies.map((reply) => {
                          const replyAtts = getReplyAttachments(reply.id)
                          return (
                            <div key={reply.id} className="rounded-md bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">답글</Badge>
                                <span className="text-muted-foreground text-[10px]">{formatDate(reply.createdAt)}</span>
                              </div>
                              <p className="text-xs whitespace-pre-wrap">{reply.content}</p>
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
                        <div className="flex items-center gap-2">
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

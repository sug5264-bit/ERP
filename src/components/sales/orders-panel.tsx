'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { toast } from 'sonner'
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
} from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface OrderItem {
  id: string
  orderNo?: string
  partner?: { partnerName?: string }
}

interface NoteItem {
  id: string
  content: string
  relatedId: string
  createdAt: string
}

interface AttachmentItem {
  id: string
  relatedId: string
  mimeType: string
  fileName: string
  fileSize?: number
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

function formatFileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function OrdersPanel() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const filterOrderId = 'all'
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Write form state
  const [writeOpen, setWriteOpen] = useState(false)
  const [postOrderId, setPostOrderId] = useState<string>('')
  const [postChannelType, setPostChannelType] = useState<string>('ONLINE')
  const [postTitle, setPostTitle] = useState('')
  const [postContent, setPostContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Data fetching
  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-all'],
    queryFn: () => api.get('/sales/orders?pageSize=500'),
    staleTime: 5 * 60 * 1000,
  })
  const orders: OrderItem[] = ordersData?.data || []

  const { data: notesData, isLoading } = useQuery({
    queryKey: ['notes', 'SalesOrder', filterOrderId, channelFilter, startDate, endDate],
    queryFn: () => {
      let url = `/notes?relatedTable=SalesOrder`
      if (filterOrderId && filterOrderId !== 'all') url += `&relatedId=${filterOrderId}`
      return api.get(url)
    },
  })
  const notes: NoteItem[] = notesData?.data || []

  const { data: allAttachmentsData } = useQuery({
    queryKey: ['attachments', 'SalesOrderPost'],
    queryFn: () => {
      const url = `/attachments?relatedTable=SalesOrderPost`
      return api.get(url)
    },
  })
  const allAttachments: AttachmentItem[] = allAttachmentsData?.data || []

  const orderMap = new Map(orders.map((o) => [o.id, o.orderNo || o.id?.slice(-6) || '']))

  const getPostAttachments = (noteId: string) => allAttachments.filter((a) => a.relatedId === noteId)

  // Filter notes by date range, channel, and search keyword
  const filteredNotes = notes.filter((n) => {
    // Date filter
    if (startDate || endDate) {
      const noteDate = n.createdAt?.split('T')[0] || ''
      if (startDate && noteDate < startDate) return false
      if (endDate && noteDate > endDate) return false
    }
    // Channel filter
    if (channelFilter !== 'all') {
      const expectedLabel = channelFilter === 'ONLINE' ? '온라인' : '오프라인'
      const channelMatch = n.content.match(/^\[(온라인|오프라인)\]/)
      if (channelMatch && channelMatch[1] !== expectedLabel) return false
      if (!channelMatch) return false
    }
    // Search filter
    if (searchKeyword) {
      const lowerSearch = searchKeyword.toLowerCase()
      const matchContent = n.content.toLowerCase().includes(lowerSearch)
      const matchOrder = (orderMap.get(n.relatedId) || '').toLowerCase().includes(lowerSearch)
      if (!matchContent && !matchOrder) return false
    }
    return true
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setPendingFiles((prev) => [...prev, ...Array.from(files)])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmitPost = async () => {
    if (!postContent.trim()) {
      toast.error('내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      // Build content with channel type prefix
      const channelPrefix = postChannelType === 'ONLINE' ? '[온라인]' : '[오프라인]'
      const titlePart = postTitle ? `[${postTitle}]` : ''
      const content = `${channelPrefix}${titlePart}\n${postContent.trim()}`

      // If order is selected, use it; otherwise create without order linkage
      const relatedId = postOrderId && postOrderId !== 'none' ? postOrderId : undefined

      const noteResult = await api.post('/notes', {
        content,
        relatedTable: 'SalesOrder',
        relatedId: relatedId || 'GENERAL',
      })
      const noteId = noteResult?.data?.id

      if (pendingFiles.length > 0 && noteId) {
        for (const file of pendingFiles) {
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('relatedTable', 'SalesOrderPost')
            formData.append('relatedId', noteId)
            await api.upload('/attachments', formData)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : `"${file.name}" 업로드 실패`)
          }
        }
      }

      // Also create a mirrored note in Delivery table for 출하관리 to see
      await api
        .post('/notes', {
          content: `[수주글]\n${content}`,
          relatedTable: 'DeliveryPost',
          relatedId: noteId || 'GENERAL',
        })
        .catch(() => {
          // Silently handle if delivery note creation fails
        })

      queryClient.invalidateQueries({ queryKey: ['notes', 'SalesOrder'] })
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryPost'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'SalesOrderPost'] })
      setPostTitle('')
      setPostContent('')
      setPostOrderId('')
      setPendingFiles([])
      setWriteOpen(false)
      toast.success('게시글이 등록되었습니다.')
    } catch {
      toast.error('게시글 등록에 실패했습니다.')
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notes/${id}`)
      queryClient.invalidateQueries({ queryKey: ['notes', 'SalesOrder'] })
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryPost'] })
      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryReply'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'SalesOrderPost'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'DeliveryReplyPost'] })
      toast.success('게시글이 삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={writeOpen} onOpenChange={setWriteOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> 글쓰기
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>게시글 작성</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">온라인/오프라인 구분 *</label>
                <Select value={postChannelType} onValueChange={setPostChannelType}>
                  <SelectTrigger>
                    <SelectValue placeholder="구분 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONLINE">온라인</SelectItem>
                    <SelectItem value="OFFLINE">오프라인</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">발주 선택 (선택사항)</label>
                <Select value={postOrderId} onValueChange={setPostOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="발주를 선택하세요 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안함</SelectItem>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.orderNo || o.id?.slice(-6)} - {o.partner?.partnerName || ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">제목</label>
                <Input
                  placeholder="제목을 입력하세요 (선택사항)"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">내용 *</label>
                <Textarea
                  placeholder="내용을 입력하세요..."
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
                        <Paperclip className="h-3 w-3" />
                        {f.name}
                        <button
                          type="button"
                          onClick={() => removePendingFile(idx)}
                          className="text-destructive ml-1 hover:opacity-70"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSubmitPost} disabled={!postContent.trim() || submitting} size="sm">
                  <Send className="mr-1 h-3.5 w-3.5" />
                  {submitting ? '등록 중...' : '등록'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="전체 구분" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="ONLINE">온라인</SelectItem>
            <SelectItem value="OFFLINE">오프라인</SelectItem>
          </SelectContent>
        </Select>

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
          {filteredNotes.length}건
        </Badge>
      </div>

      {/* Posts List */}
      <div className="space-y-2">
        {isLoading && <div className="text-muted-foreground py-12 text-center text-sm">불러오는 중...</div>}
        {!isLoading && filteredNotes.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <MessageSquare className="mb-2 h-8 w-8" />
            <p className="text-sm">등록된 게시글이 없습니다.</p>
            <p className="mt-1 text-xs">글쓰기 버튼으로 새 게시글을 작성하세요.</p>
          </div>
        )}
        {filteredNotes.map((note, idx) => {
          const postNo = filteredNotes.length - idx
          const postFiles = getPostAttachments(note.id)
          const isExpanded = expandedId === note.id
          const orderNo =
            orderMap.get(note.relatedId) || (note.relatedId === 'GENERAL' ? '일반' : note.relatedId?.slice(-6))

          // Parse channel type and title from content
          const channelMatch = note.content.match(/^\[(온라인|오프라인)\]/)
          const channelType = channelMatch ? channelMatch[1] : null
          const contentAfterChannel = channelMatch ? note.content.slice(channelMatch[0].length) : note.content
          const titleMatch = contentAfterChannel.match(/^\[(.+?)\]\n?/)
          const title = titleMatch ? titleMatch[1] : null
          const body = titleMatch
            ? contentAfterChannel.slice(titleMatch[0].length)
            : contentAfterChannel.replace(/^\n/, '')

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
                      {channelType && (
                        <Badge variant={channelType === '온라인' ? 'default' : 'secondary'} className="text-[10px]">
                          {channelType}
                        </Badge>
                      )}
                      {note.relatedId !== 'GENERAL' && (
                        <Badge variant="outline" className="text-[10px]">
                          {orderNo}
                        </Badge>
                      )}
                      {postFiles.length > 0 && (
                        <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                          <Paperclip className="h-3 w-3" />
                          {postFiles.length}
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
                  {/* Full content */}
                  <p className="text-sm break-all whitespace-pre-wrap">{body}</p>

                  {/* Attachments */}
                  {postFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium">첨부파일</p>
                      <div className="flex flex-wrap gap-2">
                        {postFiles.map((att) => {
                          const Icon = getFileIcon(att.mimeType)
                          const typeBadge = getFileTypeBadge(att.mimeType, att.fileName)
                          return (
                            <button
                              key={att.id}
                              onClick={() => window.open(`/api/v1/attachments/${att.id}`, '_blank')}
                              className="bg-muted/50 hover:bg-muted flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-colors"
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="max-w-[160px] truncate">{att.fileName}</span>
                              {att.fileSize && (
                                <span className="text-muted-foreground text-[10px]">
                                  ({formatFileSize(att.fileSize)})
                                </span>
                              )}
                              <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${typeBadge.color}`}>
                                {typeBadge.label}
                              </span>
                              <Download className="text-muted-foreground h-3 w-3" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
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

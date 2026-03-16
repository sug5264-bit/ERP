'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

export default function ThreePLOrderPostsPage() {
  const queryClient = useQueryClient()
  const [selectedShipperId, setSelectedShipperId] = useState<string>('all')
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 화주사 목록
  const { data: shippersData } = useQuery({
    queryKey: ['3pl-shippers-all'],
    queryFn: () => api.get('/sales/3pl/shippers?pageSize=500'),
    staleTime: 5 * 60 * 1000,
  })
  const shippers: ShipperItem[] = shippersData?.data || []

  // 게시글 조회 (모든 화주사 or 특정 화주사)
  const { data: notesData } = useQuery({
    queryKey: ['shipper-order-posts', selectedShipperId],
    queryFn: () => {
      const url =
        selectedShipperId && selectedShipperId !== 'all'
          ? `/notes?relatedTable=ShipperOrderPost&relatedId=${selectedShipperId}`
          : `/notes?relatedTable=ShipperOrderPost`
      return api.get(url)
    },
  })
  const notes: NoteItem[] = notesData?.data || []

  // 답글 조회
  const noteIds = notes.map((n) => n.id)
  const { data: repliesData } = useQuery({
    queryKey: ['shipper-order-replies', noteIds.join(',')],
    queryFn: async () => {
      if (noteIds.length === 0) return { data: [] }
      return api.get(`/notes?relatedTable=ShipperOrderReply`)
    },
    enabled: noteIds.length > 0,
  })
  const allReplies: NoteItem[] = repliesData?.data || []

  // 첨부파일 조회
  const { data: attachmentsData } = useQuery({
    queryKey: ['shipper-order-attachments'],
    queryFn: () => api.get('/attachments?relatedTable=ShipperOrderAttachment'),
  })
  const allAttachments: AttachmentItem[] = attachmentsData?.data || []

  const shipperMap = new Map(shippers.map((s) => [s.id, s]))
  const getPostReplies = (noteId: string) => allReplies.filter((r) => r.relatedId === noteId)
  const getPostAttachments = (noteId: string) => allAttachments.filter((a) => a.relatedId === noteId)

  const handleReply = async () => {
    if (!replyContent.trim() || !replyTargetId) return
    setSubmitting(true)
    try {
      await api.post('/notes', {
        content: replyContent.trim(),
        relatedTable: 'ShipperOrderReply',
        relatedId: replyTargetId,
      })
      queryClient.invalidateQueries({ queryKey: ['shipper-order-replies'] })
      setReplyContent('')
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
      queryClient.invalidateQueries({ queryKey: ['shipper-order-replies'] })
      toast.success('답글이 삭제되었습니다.')
    } catch {
      toast.error('답글 삭제에 실패했습니다.')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="수주/출하 게시판" description="화주사 게시글 확인 및 답글 작성" />

      {/* 필터 */}
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

      {/* 게시글 목록 */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <MessageSquare className="mb-2 h-8 w-8" />
            <p className="text-sm">작성된 게시글이 없습니다.</p>
          </div>
        ) : (
          notes.map((note) => {
            const shipper = shipperMap.get(note.relatedId)
            const replies = getPostReplies(note.id)
            const postFiles = getPostAttachments(note.id)
            const isReplyOpen = replyTargetId === note.id

            return (
              <div key={note.id} className="space-y-3 rounded-lg border p-4">
                {/* 원글 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {shipper ? `[${shipper.companyCode}] ${shipper.companyName}` : note.relatedId.slice(-6)}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{formatDate(note.createdAt)}</span>
                    </div>
                    <p className="text-sm break-all whitespace-pre-wrap">{note.content}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    onClick={() => {
                      setReplyTargetId(isReplyOpen ? null : note.id)
                      setReplyContent('')
                    }}
                  >
                    <CornerDownRight className="mr-1 h-3 w-3" />
                    답글
                  </Button>
                </div>

                {/* 첨부파일 */}
                {postFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {postFiles.map((att) => {
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
                          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${typeBadge.color}`}>
                            {typeBadge.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* 기존 답글들 */}
                {replies.length > 0 && (
                  <div className="border-primary/20 ml-2 space-y-2 border-l-2 pl-3">
                    {replies.map((reply) => (
                      <div key={reply.id} className="bg-muted/30 rounded-md p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="mb-1 flex items-center gap-1.5">
                              <CornerDownRight className="text-primary h-3 w-3" />
                              <span className="text-primary text-xs font-medium">관리자 답변</span>
                              <span className="text-muted-foreground text-xs">{formatDate(reply.createdAt)}</span>
                            </div>
                            <p className="text-sm break-all whitespace-pre-wrap">{reply.content}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-6 w-6 shrink-0"
                            onClick={() => setDeleteTarget(reply.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 답글 작성 영역 */}
                {isReplyOpen && (
                  <div className="border-primary/20 ml-4 space-y-2 border-l-2 pl-3">
                    <Textarea
                      placeholder="답글을 작성하세요..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={2}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReplyTargetId(null)
                          setReplyContent('')
                        }}
                      >
                        취소
                      </Button>
                      <Button onClick={handleReply} disabled={!replyContent.trim() || submitting} size="sm">
                        <Send className="mr-1 h-3.5 w-3.5" />
                        {submitting ? '등록 중...' : '답글 등록'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

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

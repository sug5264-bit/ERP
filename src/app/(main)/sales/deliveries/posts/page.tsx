'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import {
  Trash2,
  Send,
  Search,
  MessageSquare,
  Paperclip,
  FileImage,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

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

export default function DeliveryPostsPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('all')
  const [postDeliveryId, setPostDeliveryId] = useState<string>('')
  const [newContent, setNewContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: deliveriesData } = useQuery({
    queryKey: ['sales-deliveries-all'],
    queryFn: async () => {
      const res = await fetch('/api/v1/sales/deliveries?pageSize=9999')
      return res.json()
    },
  })
  const deliveries = deliveriesData?.data?.data || deliveriesData?.data || []

  const { data: notesData } = useQuery({
    queryKey: ['notes', 'Delivery', selectedDeliveryId],
    queryFn: async () => {
      const url =
        selectedDeliveryId && selectedDeliveryId !== 'all'
          ? `/api/v1/notes?relatedTable=Delivery&relatedId=${selectedDeliveryId}`
          : `/api/v1/notes?relatedTable=Delivery`
      const res = await fetch(url)
      return res.json()
    },
  })
  const notes = notesData?.data || []

  const { data: allAttachmentsData } = useQuery({
    queryKey: ['attachments', 'DeliveryPost', selectedDeliveryId],
    queryFn: async () => {
      const url =
        selectedDeliveryId && selectedDeliveryId !== 'all'
          ? `/api/v1/attachments?relatedTable=DeliveryPost&relatedId=${selectedDeliveryId}`
          : `/api/v1/attachments?relatedTable=DeliveryPost`
      const res = await fetch(url)
      return res.json()
    },
  })
  const allAttachments = allAttachmentsData?.data || []

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setPendingFiles((prev) => [...prev, ...Array.from(files)])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleAddPost = async () => {
    if (!newContent.trim() || !postDeliveryId) {
      toast.error('납품 선택 및 내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim(), relatedTable: 'Delivery', relatedId: postDeliveryId }),
      })
      if (!res.ok) throw new Error()
      const noteResult = await res.json()
      const noteId = noteResult?.data?.id

      if (pendingFiles.length > 0 && noteId) {
        for (const file of pendingFiles) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('relatedTable', 'DeliveryPost')
          formData.append('relatedId', noteId)
          await fetch('/api/v1/attachments', { method: 'POST', body: formData }).catch(() => {})
        }
      }

      queryClient.invalidateQueries({ queryKey: ['notes', 'Delivery'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'DeliveryPost'] })
      setNewContent('')
      setPendingFiles([])
      toast.success('게시글이 등록되었습니다.')
    } catch {
      toast.error('게시글 등록에 실패했습니다.')
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/notes/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['notes', 'Delivery'] })
      toast.success('게시글이 삭제되었습니다.')
    } catch {
      toast.error('게시글 삭제에 실패했습니다.')
    }
    setDeleteTarget(null)
  }

  const deliveryMap = new Map(deliveries.map((d: any) => [d.id, d.deliveryNo || d.id.slice(-6)]))
  const getPostAttachments = (noteId: string) => allAttachments.filter((a: any) => a.relatedId === noteId)

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="게시글" description="납품 관련 게시글 관리 (파일 첨부 가능)" />

      {/* 작성 영역 */}
      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-medium">게시글 작성</h3>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">납품 선택</label>
          <Select value={postDeliveryId} onValueChange={setPostDeliveryId}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="납품 선택" />
            </SelectTrigger>
            <SelectContent>
              {deliveries.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.deliveryNo || d.id.slice(-6)} -{' '}
                  {d.salesOrder?.partner?.partnerName || d.partner?.partnerName || ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Textarea
            placeholder="게시글을 작성하세요..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="mr-1 h-3 w-3" />
              파일 첨부
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            {pendingFiles.map((f, idx) => (
              <span key={idx} className="bg-muted flex items-center gap-1 rounded px-2 py-1 text-xs">
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
          <p className="text-muted-foreground text-[10px]">
            PDF, Excel, Word, 이미지 등 다양한 파일 첨부 가능 (최대 50MB)
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleAddPost} disabled={!newContent.trim() || !postDeliveryId || submitting} size="sm">
            <Send className="mr-1 h-3.5 w-3.5" />
            {submitting ? '등록 중...' : '등록'}
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Search className="text-muted-foreground h-4 w-4" />
        <Select value={selectedDeliveryId} onValueChange={setSelectedDeliveryId}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="전체 납품" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 납품</SelectItem>
            {deliveries.map((d: any) => (
              <SelectItem key={d.id} value={d.id}>
                {d.deliveryNo || d.id.slice(-6)} - {d.salesOrder?.partner?.partnerName || d.partner?.partnerName || ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{notes.length}건</Badge>
      </div>

      {/* 게시글 목록 */}
      <div className="space-y-2">
        {notes.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <MessageSquare className="mb-2 h-8 w-8" />
            <p className="text-sm">작성된 게시글이 없습니다.</p>
          </div>
        ) : (
          notes.map((note: any) => {
            const postFiles = getPostAttachments(note.id)
            return (
              <div key={note.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm break-all whitespace-pre-wrap">{note.content}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-7 w-7 shrink-0"
                    onClick={() => setDeleteTarget(note.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {postFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {postFiles.map((att: any) => {
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
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-xs">
                    납품 {deliveryMap.get(note.relatedId) || note.relatedId?.slice(-6)}
                  </Badge>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
              </div>
            )
          })
        )}
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

'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'
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
  MessageSquare,
  Paperclip,
  FileImage,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  CornerDownRight,
} from 'lucide-react'

interface NoteItem {
  id: string
  content: string
  relatedId: string
  createdBy: string
  createdAt: string
  replies: { id: string; content: string; createdAt: string; createdBy: string }[]
  attachments: { id: string; fileName: string; mimeType: string }[]
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

export default function ShipperPostsPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newContent, setNewContent] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: postsData } = useQuery({
    queryKey: ['shipper-posts'],
    queryFn: () => api.get('/shipper/posts'),
  })
  const posts: NoteItem[] = postsData?.data || []

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setPendingFiles((prev) => [...prev, ...Array.from(files)])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleAddPost = async () => {
    if (!newContent.trim()) {
      toast.error('내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      const noteResult = await api.post('/shipper/posts', { content: newContent.trim() })
      const noteId = noteResult?.data?.id

      if (pendingFiles.length > 0 && noteId) {
        for (const file of pendingFiles) {
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('relatedTable', 'ShipperOrderAttachment')
            formData.append('relatedId', noteId)
            await api.upload('/attachments', formData)
          } catch {
            toast.error(`첨부파일 "${file.name}" 업로드에 실패했습니다.`)
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['shipper-posts'] })
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
      await api.delete(`/notes/${id}`)
      queryClient.invalidateQueries({ queryKey: ['shipper-posts'] })
      toast.success('게시글이 삭제되었습니다.')
    } catch {
      toast.error('게시글 삭제에 실패했습니다.')
    }
    setDeleteTarget(null)
  }

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="발주/출고" description="발주/출고 관련 문의 및 파일을 게시하고, 관리자 답변을 확인합니다" />

        {/* 작성 영역 */}
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-medium">게시글 작성</h3>
          <div className="space-y-2">
            <Textarea
              placeholder="발주/출고 관련 내용을 작성하세요..."
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
            <Button onClick={handleAddPost} disabled={!newContent.trim() || submitting} size="sm">
              <Send className="mr-1 h-3.5 w-3.5" />
              {submitting ? '등록 중...' : '등록'}
            </Button>
          </div>
        </div>

        {/* 게시글 목록 */}
        <div className="flex items-center gap-2">
          <MessageSquare className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">게시글 목록</span>
          <Badge variant="secondary">{posts.length}건</Badge>
        </div>

        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <MessageSquare className="mb-2 h-8 w-8" />
              <p className="text-sm">작성된 게시글이 없습니다.</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="space-y-3 rounded-lg border p-4">
                {/* 원글 */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm break-all whitespace-pre-wrap">{post.content}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-7 w-7 shrink-0"
                    onClick={() => setDeleteTarget(post.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* 첨부파일 */}
                {post.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.attachments.map((att) => {
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

                <div className="text-muted-foreground text-xs">{formatDate(post.createdAt)}</div>

                {/* 답글들 */}
                {post.replies.length > 0 && (
                  <div className="border-primary/20 ml-2 space-y-2 border-l-2 pl-3">
                    {post.replies.map((reply) => (
                      <div key={reply.id} className="bg-muted/30 rounded-md p-3">
                        <div className="mb-1 flex items-center gap-1.5">
                          <CornerDownRight className="text-primary h-3 w-3" />
                          <span className="text-primary text-xs font-medium">관리자 답변</span>
                        </div>
                        <p className="text-sm break-all whitespace-pre-wrap">{reply.content}</p>
                        <p className="text-muted-foreground mt-1 text-xs">{formatDate(reply.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
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
    </ShipperLayoutShell>
  )
}

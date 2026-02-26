'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Eye, FileText, MessageCircle, Paperclip, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const columns: ColumnDef<any>[] = [
  {
    header: '제목',
    accessorKey: 'title',
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
  { id: 'author', header: '작성자', cell: ({ row }) => row.original.author?.name || '-' },
  { id: 'createdAt', header: '작성일', cell: ({ row }) => formatDate(row.original.createdAt) },
  {
    id: 'viewCount',
    header: '조회',
    cell: ({ row }) => (
      <span className="text-muted-foreground flex items-center gap-1">
        <Eye className="h-3 w-3" />
        {row.original.viewCount}
      </span>
    ),
  },
]

export default function GeneralBoardPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<any>(null)
  const [newComment, setNewComment] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['board-general'],
    queryFn: () => api.get('/board/posts?boardCode=GENERAL&pageSize=50') as Promise<any>,
  })
  const { data: boardsData } = useQuery({
    queryKey: ['boards'],
    queryFn: () => api.get('/board/boards') as Promise<any>,
  })

  const generalBoard = (boardsData?.data || []).find((b: any) => b.boardCode === 'GENERAL')

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/board/posts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-general'] })
      setOpen(false)
      toast.success('게시글이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/board/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-general'] })
      toast.success('게시글이 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    setDeleteTarget({ id, name: title })
  }

  const commentMutation = useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      api.post(`/board/posts/${postId}/comments`, { content }),
    onSuccess: async (_, variables) => {
      try {
        const res = (await api.get(`/board/posts/${variables.postId}`)) as any
        setSelectedPost(res.data || res)
      } catch {
        queryClient.invalidateQueries({ queryKey: ['board-general-posts'] })
      }
      setNewComment('')
      toast.success('댓글이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!generalBoard) {
      toast.error('게시판 정보를 찾을 수 없습니다.')
      return
    }

    const postData: any = {
      boardId: generalBoard.id,
      title: form.get('title'),
      content: form.get('content'),
      attachments: attachments.map((f) => f.name),
      fileName: attachments.length > 0 ? attachments[0].name : undefined,
    }
    createMutation.mutate(postData)
  }

  const handleRowClick = async (row: any) => {
    try {
      const res = (await api.get(`/board/posts/${row.id}`)) as any
      setSelectedPost(res.data || res)
      setDetailOpen(true)
    } catch {
      toast.error('게시글을 불러올 수 없습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="자유게시판" description="자유롭게 의견을 나눌 수 있는 게시판입니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>글 작성</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>게시글 작성</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>
                  제목 <span className="text-destructive">*</span>
                </Label>
                <Input name="title" required aria-required="true" />
              </div>
              <div className="space-y-2">
                <Label>
                  내용 <span className="text-destructive">*</span>
                </Label>
                <Textarea name="content" rows={8} required />
              </div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.txt,.zip,.jpg,.jpeg,.png,.gif"
                />
                {attachments.length > 0 && (
                  <div className="text-muted-foreground text-xs">
                    {attachments.map((f) => (
                      <div key={`${f.name}-${f.size}`} className="flex items-center gap-1">
                        <span>{f.name}</span>
                        <span>({(f.size / 1024).toFixed(1)}KB)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '게시글 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={[
          ...columns,
          {
            id: 'delete',
            header: '',
            cell: ({ row }: any) => (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-8 w-8"
                onClick={(e: any) => handleDelete(e, row.original.id, row.original.title)}
                aria-label="삭제"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ),
            size: 50,
          },
        ]}
        data={data?.data || []}
        searchColumn="title"
        searchPlaceholder="제목으로 검색..."
        isLoading={isLoading}
        pageSize={50}
        onRowClick={handleRowClick}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85dvh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPost?.title}</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <span>{selectedPost.author?.name}</span>
                <span>{formatDate(selectedPost.createdAt)}</span>
                <span>조회 {selectedPost.viewCount}</span>
              </div>
              <div className="min-h-[200px] rounded-md border p-4 text-sm whitespace-pre-wrap">
                {selectedPost.content}
              </div>
              {selectedPost?.attachments && selectedPost.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">첨부파일</Label>
                  <div className="space-y-1">
                    {selectedPost.attachments.map((a: any) => (
                      <div
                        key={a.id || a.fileName || a}
                        className="text-primary flex cursor-pointer items-center gap-2 text-sm hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        <span>{a.fileName || a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedPost?.fileName && (!selectedPost?.attachments || selectedPost.attachments.length === 0) && (
                <div className="bg-muted flex items-center gap-2 rounded p-2 text-sm">
                  <Paperclip className="h-4 w-4" />
                  <span>{selectedPost.fileName}</span>
                </div>
              )}
              <div className="space-y-3">
                <Label className="flex items-center gap-1 text-sm font-medium">
                  <MessageCircle className="h-4 w-4" /> 댓글 ({selectedPost.comments?.length || 0})
                </Label>
                {(selectedPost.comments || []).map((c: any) => (
                  <div key={c.id} className="rounded border p-2 text-sm">
                    <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                      <span className="text-foreground font-medium">{c.author?.name}</span>
                      <span>{formatDate(c.createdAt)}</span>
                    </div>
                    <p>{c.content}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      newComment.trim() && commentMutation.mutate({ postId: selectedPost.id, content: newComment })
                    }
                    disabled={commentMutation.isPending || !newComment.trim()}
                  >
                    등록
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="게시글 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}

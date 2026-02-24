'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Eye, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const columns: ColumnDef<any>[] = [
  { id: 'pinned', header: '', cell: ({ row }) => row.original.isPinned ? <Badge variant="destructive" className="text-xs">필독</Badge> : null, size: 50 },
  { header: '제목', accessorKey: 'title', cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
  { id: 'author', header: '작성자', cell: ({ row }) => row.original.author?.name || '-' },
  { id: 'createdAt', header: '작성일', cell: ({ row }) => formatDate(row.original.createdAt) },
  { id: 'viewCount', header: '조회', cell: ({ row }) => <span className="flex items-center gap-1 text-muted-foreground"><Eye className="h-3 w-3" />{row.original.viewCount}</span> },
]

export default function NoticesPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<any>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['board-notices'], queryFn: () => api.get('/board/posts?boardCode=NOTICE&pageSize=50') as Promise<any> })
  const { data: boardsData } = useQuery({ queryKey: ['boards'], queryFn: () => api.get('/board/boards') as Promise<any> })

  const noticeBoard = (boardsData?.data || []).find((b: any) => b.boardCode === 'NOTICE')

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const result = await api.post('/board/posts', body)
      await queryClient.invalidateQueries({ queryKey: ['board-notices'] })
      return result
    },
    onSuccess: () => { setOpen(false); setIsPinned(false); toast.success('공지사항이 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await api.delete(`/board/posts/${id}`)
      await queryClient.invalidateQueries({ queryKey: ['board-notices'] })
      return result
    },
    onSuccess: () => { toast.success('공지사항이 삭제되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    setDeleteTarget({ id, name: title })
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (!noticeBoard) { toast.error('게시판 정보를 찾을 수 없습니다.'); return }
    createMutation.mutate({ boardId: noticeBoard.id, title: form.get('title'), content: form.get('content'), isPinned })
  }

  const handleRowClick = async (row: any) => {
    try {
      const res = await api.get(`/board/posts/${row.id}`) as any
      setSelectedPost(res.data || res)
      setDetailOpen(true)
    } catch { toast.error('게시글을 불러올 수 없습니다.') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="공지사항" description="전사 공지사항을 확인합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>공지 등록</Button></DialogTrigger>
          <DialogContent className="max-w-sm sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>공지사항 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>제목 <span className="text-destructive">*</span></Label><Input name="title" required aria-required="true" /></div>
              <div className="space-y-2"><Label>내용 <span className="text-destructive">*</span></Label><Textarea name="content" rows={8} required /></div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isPinned" checked={isPinned} onCheckedChange={(v) => setIsPinned(v as boolean)} />
                <Label htmlFor="isPinned">상단 고정 (필독)</Label>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '등록 중...' : '공지 등록'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={[...columns, { id: 'delete', header: '', cell: ({ row }: any) => <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e: any) => handleDelete(e, row.original.id, row.original.title)} aria-label="삭제"><Trash2 className="h-4 w-4" /></Button>, size: 50 }]} data={data?.data || []} searchColumn="title" searchPlaceholder="제목으로 검색..." isLoading={isLoading} pageSize={50} onRowClick={handleRowClick} />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-sm sm:max-w-xl md:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedPost?.title}</DialogTitle></DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{selectedPost.author?.name}</span>
                <span>{formatDate(selectedPost.createdAt)}</span>
                <span>조회 {selectedPost.viewCount}</span>
              </div>
              <div className="border rounded-md p-4 text-sm whitespace-pre-wrap min-h-[200px]">{selectedPost.content}</div>
              {selectedPost.comments?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">댓글 ({selectedPost.comments.length})</Label>
                  {selectedPost.comments.map((c: any) => (
                    <div key={c.id} className="border rounded p-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <span className="font-medium text-foreground">{c.author?.name}</span>
                        <span>{formatDate(c.createdAt)}</span>
                      </div>
                      <p>{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="공지사항 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}

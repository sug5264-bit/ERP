'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Trash2, Send, Search, MessageSquare } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

export default function OrderPostsPage() {
  const queryClient = useQueryClient()
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [postOrderId, setPostOrderId] = useState<string>('')
  const [newContent, setNewContent] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // 발주 목록 조회
  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-all'],
    queryFn: async () => {
      const res = await fetch('/api/v1/sales/orders?pageSize=9999')
      return res.json()
    },
  })
  const orders = ordersData?.data?.data || ordersData?.data || []

  // 게시글 목록 조회
  const { data: notesData } = useQuery({
    queryKey: ['notes', 'SalesOrder', selectedOrderId],
    queryFn: async () => {
      const url = selectedOrderId
        ? `/api/v1/notes?relatedTable=SalesOrder&relatedId=${selectedOrderId}`
        : `/api/v1/notes?relatedTable=SalesOrder`
      const res = await fetch(url)
      return res.json()
    },
  })
  const notes = notesData?.data || []

  const handleAddPost = async () => {
    if (!newContent.trim() || !postOrderId) {
      toast.error('발주 선택 및 내용을 입력해주세요.')
      return
    }
    try {
      const res = await fetch('/api/v1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim(), relatedTable: 'SalesOrder', relatedId: postOrderId }),
      })
      if (!res.ok) throw new Error()
      queryClient.invalidateQueries({ queryKey: ['notes', 'SalesOrder'] })
      setNewContent('')
      toast.success('게시글이 등록되었습니다.')
    } catch {
      toast.error('게시글 등록에 실패했습니다.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/notes/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['notes', 'SalesOrder'] })
      toast.success('게시글이 삭제되었습니다.')
    } catch {
      toast.error('게시글 삭제에 실패했습니다.')
    }
    setDeleteTarget(null)
  }

  // 발주번호 매핑
  const orderMap = new Map(orders.map((o: any) => [o.id, o.orderNo || o.id.slice(-6)]))

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="게시글" description="발주 관련 게시글 관리" />

      {/* 작성 영역 */}
      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-medium">게시글 작성</h3>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">발주 선택</label>
          <Select value={postOrderId} onValueChange={setPostOrderId}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="발주 선택" />
            </SelectTrigger>
            <SelectContent>
              {orders.map((o: any) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.orderNo || o.id.slice(-6)} - {o.partner?.partnerName || ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="게시글을 작성하세요..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="flex-1"
          />
          <Button onClick={handleAddPost} disabled={!newContent.trim() || !postOrderId} size="sm" className="self-end">
            <Send className="mr-1 h-3.5 w-3.5" />
            등록
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Search className="text-muted-foreground h-4 w-4" />
        <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="전체 발주" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">전체 발주</SelectItem>
            {orders.map((o: any) => (
              <SelectItem key={o.id} value={o.id}>
                {o.orderNo || o.id.slice(-6)} - {o.partner?.partnerName || ''}
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
          notes.map((note: any) => (
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
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-xs">
                  발주 {orderMap.get(note.relatedId) || note.relatedId?.slice(-6)}
                </Badge>
                <span>{formatDate(note.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="게시글 삭제"
        description="이 게시글을 삭제하시겠습니까?"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        variant="destructive"
      />
    </div>
  )
}

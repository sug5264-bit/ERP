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
import { Download, Trash2, Upload, Paperclip, Search, FileImage, FileText, File as FileIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('pdf') || mimeType.includes('text')) return FileText
  return FileIcon
}

export default function OrderNotesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [uploadOrderId, setUploadOrderId] = useState<string>('')
  const [memo, setMemo] = useState('')
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

  // 첨부파일 목록 조회
  const { data: attachmentsData } = useQuery({
    queryKey: ['attachments', 'SalesOrder', selectedOrderId],
    queryFn: async () => {
      const url = selectedOrderId
        ? `/api/v1/attachments?relatedTable=SalesOrder&relatedId=${selectedOrderId}`
        : `/api/v1/attachments?relatedTable=SalesOrder`
      const res = await fetch(url)
      return res.json()
    },
  })
  const attachments = attachmentsData?.data || []

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!uploadOrderId) {
      toast.error('발주를 먼저 선택해 주세요.')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('relatedTable', 'SalesOrder')
    formData.append('relatedId', uploadOrderId)
    try {
      const res = await fetch('/api/v1/attachments', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      queryClient.invalidateQueries({ queryKey: ['attachments', 'SalesOrder'] })
      toast.success('파일이 업로드되었습니다.')
    } catch {
      toast.error('파일 업로드에 실패했습니다.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSaveMemo = async () => {
    if (!memo.trim() || !uploadOrderId) {
      toast.error('발주 선택 및 메모 내용을 입력해주세요.')
      return
    }
    try {
      const res = await fetch('/api/v1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: memo.trim(), relatedTable: 'SalesOrder', relatedId: uploadOrderId }),
      })
      if (!res.ok) throw new Error()
      toast.success('특이사항 메모가 저장되었습니다.')
      setMemo('')
    } catch {
      toast.error('메모 저장에 실패했습니다.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/v1/attachments/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'SalesOrder'] })
      toast.success('파일이 삭제되었습니다.')
    } catch {
      toast.error('파일 삭제에 실패했습니다.')
    }
    setDeleteTarget(null)
  }

  // 발주번호 매핑
  const orderMap = new Map(orders.map((o: any) => [o.id, o.orderNo || o.id.slice(-6)]))

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="특이사항" description="발주 관련 파일 첨부 및 특이사항 관리" />

      {/* 업로드 영역 */}
      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-medium">파일 업로드 / 메모 추가</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">발주 선택</label>
            <Select value={uploadOrderId} onValueChange={setUploadOrderId}>
              <SelectTrigger>
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
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">파일 첨부</label>
            <div className="flex gap-2">
              <Input ref={fileInputRef} type="file" onChange={handleUpload} className="flex-1" />
            </div>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-muted-foreground text-xs">특이사항 메모</label>
            <Textarea
              placeholder="특이사항을 입력하세요..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={handleSaveMemo} disabled={!memo.trim() || !uploadOrderId} size="sm">
            저장
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
        <Badge variant="secondary">{attachments.length}건</Badge>
      </div>

      {/* 첨부파일 목록 */}
      <div className="space-y-2">
        {attachments.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <Paperclip className="mb-2 h-8 w-8" />
            <p className="text-sm">첨부된 파일이 없습니다.</p>
          </div>
        ) : (
          attachments.map((att: any) => {
            const Icon = getFileIcon(att.mimeType)
            return (
              <div key={att.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{att.fileName}</p>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>{(att.fileSize / 1024).toFixed(1)}KB</span>
                    <span>·</span>
                    <span>발주 {orderMap.get(att.relatedId) || att.relatedId?.slice(-6)}</span>
                    <span>·</span>
                    <span>{formatDate(att.createdAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(`/api/v1/attachments/${att.id}`, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8"
                    onClick={() => setDeleteTarget(att.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="파일 삭제"
        description="이 파일을 삭제하시겠습니까?"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        variant="destructive"
      />
    </div>
  )
}

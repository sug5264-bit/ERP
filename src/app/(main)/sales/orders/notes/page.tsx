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
  Download,
  Trash2,
  Upload,
  Paperclip,
  Search,
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
  if (mimeType.includes('presentation') || ['ppt', 'pptx'].includes(ext))
    return { label: 'PPT', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' }
  if (mimeType.startsWith('image/'))
    return { label: '이미지', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' }
  if (['zip', 'rar', '7z'].includes(ext))
    return { label: '압축', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
  return { label: ext.toUpperCase() || '파일', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function OrderNotesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string>('all')
  const [uploadOrderId, setUploadOrderId] = useState<string>('')
  const [memo, setMemo] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-all'],
    queryFn: async () => {
      const res = await fetch('/api/v1/sales/orders?pageSize=9999')
      return res.json()
    },
  })
  const orders = ordersData?.data?.data || ordersData?.data || []

  const { data: attachmentsData } = useQuery({
    queryKey: ['attachments', 'SalesOrder', selectedOrderId],
    queryFn: async () => {
      const url =
        selectedOrderId && selectedOrderId !== 'all'
          ? `/api/v1/attachments?relatedTable=SalesOrder&relatedId=${selectedOrderId}`
          : `/api/v1/attachments?relatedTable=SalesOrder`
      const res = await fetch(url)
      return res.json()
    },
  })
  const attachments = attachmentsData?.data || []

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (!uploadOrderId) {
      toast.error('발주를 먼저 선택해 주세요.')
      return
    }
    setUploading(true)
    let successCount = 0
    let failCount = 0
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: 파일 크기가 50MB를 초과합니다.`)
        failCount++
        continue
      }
      const formData = new FormData()
      formData.append('file', file)
      formData.append('relatedTable', 'SalesOrder')
      formData.append('relatedId', uploadOrderId)
      try {
        const res = await fetch('/api/v1/attachments', { method: 'POST', body: formData })
        if (!res.ok) throw new Error()
        successCount++
      } catch {
        failCount++
      }
    }
    queryClient.invalidateQueries({ queryKey: ['attachments', 'SalesOrder'] })
    if (failCount > 0) {
      toast.error(`${successCount}건 업로드, ${failCount}건 실패`)
    } else {
      toast.success(`${successCount}건 파일이 업로드되었습니다.`)
    }
    setUploading(false)
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

  const orderMap = new Map(orders.map((o: any) => [o.id, o.orderNo || o.id.slice(-6)]))

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="특이사항" description="발주 관련 파일 첨부 및 특이사항 관리 (PDF, Excel, 이미지 등)" />

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
            <label className="text-muted-foreground text-xs">파일 첨부 (PDF, Excel, Word, 이미지, 압축파일 등)</label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                onChange={handleUpload}
                className="flex-1"
                disabled={uploading}
              />
              {uploading && <span className="text-muted-foreground self-center text-xs">업로드 중...</span>}
            </div>
            <p className="text-muted-foreground text-[10px]">최대 50MB · 여러 파일 동시 선택 가능</p>
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
            <SelectItem value="all">전체 발주</SelectItem>
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
            <p className="text-xs">PDF, Excel, Word, 이미지 등 다양한 파일을 업로드할 수 있습니다.</p>
          </div>
        ) : (
          attachments.map((att: any) => {
            const Icon = getFileIcon(att.mimeType)
            const typeBadge = getFileTypeBadge(att.mimeType, att.fileName)
            return (
              <div key={att.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{att.fileName}</p>
                    <span
                      className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeBadge.color}`}
                    >
                      {typeBadge.label}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>{formatFileSize(att.fileSize)}</span>
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
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget)
        }}
        variant="destructive"
      />
    </div>
  )
}

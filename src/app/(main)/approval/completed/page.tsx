'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFTED: { label: '임시저장', variant: 'secondary' },
  IN_PROGRESS: { label: '진행중', variant: 'default' },
  APPROVED: { label: '승인', variant: 'outline' },
  REJECTED: { label: '반려', variant: 'destructive' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

const columns: ColumnDef<any>[] = [
  { accessorKey: 'documentNo', header: '문서번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.documentNo}</span> },
  { header: '제목', accessorKey: 'title' },
  { id: 'drafter', header: '기안자', cell: ({ row }) => row.original.drafter?.nameKo || '-' },
  { id: 'draftDate', header: '기안일', cell: ({ row }) => formatDate(row.original.draftDate) },
  { id: 'status', header: '상태', cell: ({ row }) => { const s = STATUS_MAP[row.original.status]; return <Badge variant={s?.variant || 'outline'}>{s?.label || row.original.status}</Badge> } },
]

export default function ApprovalCompletedPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)

  const qp = new URLSearchParams({ pageSize: '50', filter: 'myDrafts' })
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading } = useQuery({ queryKey: ['approval-completed', statusFilter], queryFn: () => api.get(`/approval/documents?${qp}`) as Promise<any> })

  const completedData = (data?.data || []).filter((d: any) => ['APPROVED', 'REJECTED', 'CANCELLED'].includes(d.status))

  const handleRowClick = async (row: any) => {
    try {
      const res = await api.get(`/approval/documents/${row.id}`) as any
      setSelectedDoc(res.data || res)
      setDetailOpen(true)
    } catch { toast.error('문서를 불러올 수 없습니다.') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="결재 완료" description="처리가 완료된 결재 문서입니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="APPROVED">승인</SelectItem>
            <SelectItem value="REJECTED">반려</SelectItem>
            <SelectItem value="CANCELLED">취소</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={completedData} searchColumn="title" searchPlaceholder="제목으로 검색..." isLoading={isLoading} pageSize={50} onRowClick={handleRowClick} />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-sm sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedDoc?.title}</DialogTitle></DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">문서번호:</span> {selectedDoc.documentNo}</div>
                <div><span className="text-muted-foreground">기안일:</span> {formatDate(selectedDoc.draftDate)}</div>
                <div><span className="text-muted-foreground">기안자:</span> {selectedDoc.drafter?.nameKo}</div>
                <div><span className="text-muted-foreground">상태:</span> {STATUS_MAP[selectedDoc.status]?.label || selectedDoc.status}</div>
              </div>
              <div className="border rounded-md p-3 text-sm whitespace-pre-wrap">{selectedDoc.content?.body || '-'}</div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">결재선</Label>
                {(selectedDoc.steps || []).map((step: any, idx: number) => (
                  <div key={step.id} className="flex items-center gap-2 text-sm">
                    <span className="w-6">{idx + 1}.</span>
                    <span className="flex-1">{step.approver?.nameKo || '-'}</span>
                    <Badge variant={step.status === 'APPROVED' ? 'default' : step.status === 'REJECTED' ? 'destructive' : 'outline'}>
                      {step.status === 'APPROVED' ? '승인' : step.status === 'REJECTED' ? '반려' : '대기'}
                    </Badge>
                    {step.comment && <span className="text-muted-foreground text-xs">({step.comment})</span>}
                    {step.actionDate && <span className="text-muted-foreground text-xs">{formatDate(step.actionDate)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

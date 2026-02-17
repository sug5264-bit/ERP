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
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

const columns: ColumnDef<any>[] = [
  { accessorKey: 'documentNo', header: '문서번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.documentNo}</span> },
  { header: '제목', accessorKey: 'title' },
  { id: 'drafter', header: '기안자', cell: ({ row }) => row.original.drafter?.nameKo || '-' },
  { id: 'draftDate', header: '기안일', cell: ({ row }) => formatDate(row.original.draftDate) },
  { id: 'progress', header: '반려단계', cell: ({ row }) => <span className="text-sm">{row.original.currentStep}/{row.original.totalSteps}</span> },
  { id: 'urgency', header: '긴급도', cell: ({ row }) => row.original.urgency === 'URGENT' ? <Badge variant="destructive">긴급</Badge> : row.original.urgency === 'EMERGENCY' ? <Badge variant="destructive">초긴급</Badge> : <Badge variant="outline">일반</Badge> },
]

export default function RejectedPage() {
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['approval-rejected'],
    queryFn: () => api.get('/approval/documents?filter=myDrafts&status=REJECTED&pageSize=50') as Promise<any>,
  })

  const handleRowClick = async (row: any) => {
    try {
      const res = await api.get(`/approval/documents/${row.id}`) as any
      setSelectedDoc(res.data || res)
      setDetailOpen(true)
    } catch { toast.error('문서를 불러올 수 없습니다.') }
  }

  const getStepStatusIcon = (status: string) => {
    if (status === 'APPROVED') return <CheckCircle2 className="h-4 w-4 text-green-600" />
    if (status === 'REJECTED') return <XCircle className="h-4 w-4 text-destructive" />
    return <Clock className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <div className="space-y-6">
      <PageHeader title="반려문서" description="반려된 결재 문서 목록입니다" />
      <DataTable columns={columns} data={data?.data || []} searchColumn="title" searchPlaceholder="제목으로 검색..." isLoading={isLoading} pageSize={50} onRowClick={handleRowClick} />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedDoc?.title}</DialogTitle></DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">문서번호:</span> <span className="font-mono">{selectedDoc.documentNo}</span></div>
                <div><span className="text-muted-foreground">기안일:</span> {formatDate(selectedDoc.draftDate)}</div>
                <div><span className="text-muted-foreground">기안자:</span> {selectedDoc.drafter?.nameKo}</div>
                <div><span className="text-muted-foreground">상태:</span> <Badge variant="destructive">반려</Badge></div>
              </div>

              <div className="rounded-md border p-4 space-y-2">
                <h4 className="text-sm font-semibold">기안내용</h4>
                {selectedDoc.content?.purpose && <div className="text-sm"><span className="text-muted-foreground">목적:</span> {selectedDoc.content.purpose}</div>}
                {selectedDoc.content?.amount && <div className="text-sm"><span className="text-muted-foreground">금액:</span> {Number(selectedDoc.content.amount).toLocaleString()}원</div>}
                <div className="border rounded-md p-3 text-sm whitespace-pre-wrap bg-muted/30 mt-2">{selectedDoc.content?.body || '-'}</div>
              </div>

              <div className="rounded-md border p-4 space-y-3">
                <h4 className="text-sm font-semibold">결재선</h4>
                <div className="space-y-2">
                  {(selectedDoc.steps || []).map((step: any, idx: number) => (
                    <div key={step.id} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
                      <span className="w-6 text-center font-medium text-muted-foreground">{idx + 1}</span>
                      {getStepStatusIcon(step.status)}
                      <span className="flex-1 font-medium">
                        {step.approver?.nameKo || '-'}
                        <span className="text-muted-foreground font-normal ml-1">({step.approver?.position?.name || '-'})</span>
                      </span>
                      <Badge variant={step.status === 'APPROVED' ? 'default' : step.status === 'REJECTED' ? 'destructive' : 'outline'}>
                        {step.status === 'APPROVED' ? '승인' : step.status === 'REJECTED' ? '반려' : '대기'}
                      </Badge>
                      {step.comment && <span className="text-destructive text-xs">사유: {step.comment}</span>}
                      {step.actionDate && <span className="text-muted-foreground text-xs">{formatDate(step.actionDate)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

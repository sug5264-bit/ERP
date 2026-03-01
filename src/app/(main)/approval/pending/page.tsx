'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { CheckCircle, XCircle, CheckCheck } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface PendingDocRow {
  id: string
  documentNo: string
  title: string
  draftDate: string
  urgency: string
  currentStep: number
  totalSteps: number
  status: string
  drafter?: { nameKo: string; department?: { name: string } }
  content?: {
    docType?: string
    purpose?: string
    amount?: number | string
    period?: string
    department?: string
    body?: string
    [key: string]: unknown
  }
  steps?: {
    id: string
    status: string
    approvalType: string
    comment?: string
    actionDate?: string
    approver?: { nameKo: string; position?: { name: string } }
  }[]
}

const columns: ColumnDef<PendingDocRow>[] = [
  {
    accessorKey: 'documentNo',
    header: '문서번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.documentNo}</span>,
  },
  { header: '제목', accessorKey: 'title' },
  { id: 'drafter', header: '기안자', cell: ({ row }) => row.original.drafter?.nameKo || '-' },
  { id: 'department', header: '부서', cell: ({ row }) => row.original.drafter?.department?.name || '-' },
  { id: 'draftDate', header: '기안일', cell: ({ row }) => formatDate(row.original.draftDate) },
  {
    id: 'urgency',
    header: '긴급도',
    cell: ({ row }) =>
      row.original.urgency === 'URGENT' ? (
        <Badge variant="destructive">긴급</Badge>
      ) : row.original.urgency === 'EMERGENCY' ? (
        <Badge variant="destructive">초긴급</Badge>
      ) : (
        <Badge variant="outline">일반</Badge>
      ),
  },
  {
    id: 'progress',
    header: '진행',
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.currentStep}/{row.original.totalSteps}
      </span>
    ),
  },
]

export default function ApprovalPendingPage() {
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<PendingDocRow | null>(null)
  const [comment, setComment] = useState('')
  const [selectedRows, setSelectedRows] = useState<PendingDocRow[]>([])
  const [batchConfirm, setBatchConfirm] = useState<{ action: string; label: string; ids: string[] } | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['approval-pending'],
    queryFn: () => api.get('/approval/documents?filter=myApprovals&pageSize=50'),
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.put(`/approval/documents/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-pending'] })
      setDetailOpen(false)
      setComment('')
      toast.success('처리되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const batchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/approval/batch', body),
    onSuccess: (res: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['approval-pending'] })
      const d = (res as Record<string, unknown>)?.data || res
      const result = d as Record<string, unknown>
      const successCount = result?.successCount ?? 0
      const failCount = Number(result?.failCount ?? 0)
      toast.success(`${successCount}건 처리 완료${failCount > 0 ? `, ${failCount}건 실패` : ''}`)
      setSelectedRows([])
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleRowClick = async (row: PendingDocRow) => {
    try {
      const res = (await api.get(`/approval/documents/${row.id}`)) as Record<string, unknown>
      setSelectedDoc((res.data || res) as PendingDocRow)
      setDetailOpen(true)
    } catch {
      toast.error('문서를 불러올 수 없습니다.')
    }
  }

  const handleBatchAction = (action: string) => {
    const ids = selectedRows.map((r) => r.id)
    const label = action === 'approve' ? '승인' : '반려'
    setBatchConfirm({ action, label, ids })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="결재 대기" description="결재가 필요한 문서 목록입니다" />

      {/* 일괄 처리 버튼 */}
      {selectedRows.length > 0 && (
        <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:p-3">
          <span className="text-xs font-medium sm:text-sm">{selectedRows.length}건 선택</span>
          <Button
            size="sm"
            className="h-7 text-xs sm:h-8 sm:text-sm"
            onClick={() => handleBatchAction('approve')}
            disabled={batchMutation.isPending}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" /> 일괄 승인
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs sm:h-8 sm:text-sm"
            onClick={() => handleBatchAction('reject')}
            disabled={batchMutation.isPending}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" /> 일괄 반려
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data || []}
        searchColumn="title"
        searchPlaceholder="제목으로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
        onRowClick={handleRowClick}
        selectable
        onSelectionChange={(rows) => setSelectedRows(rows as PendingDocRow[])}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base sm:text-lg">{selectedDoc?.title}</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 sm:gap-4 sm:text-sm">
                <div>
                  <span className="text-muted-foreground">문서번호:</span> {selectedDoc.documentNo}
                </div>
                <div>
                  <span className="text-muted-foreground">기안일:</span> {formatDate(selectedDoc.draftDate)}
                </div>
                <div>
                  <span className="text-muted-foreground">기안자:</span> {selectedDoc.drafter?.nameKo}
                </div>
                <div>
                  <span className="text-muted-foreground">긴급도:</span>{' '}
                  {selectedDoc.urgency === 'NORMAL' ? '일반' : selectedDoc.urgency === 'URGENT' ? '긴급' : '초긴급'}
                </div>
              </div>
              <div className="max-h-[30vh] overflow-y-auto rounded-md border p-3 text-xs whitespace-pre-wrap sm:text-sm">
                {selectedDoc.content?.body || '-'}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium sm:text-sm">결재선</Label>
                {(selectedDoc.steps || []).map(
                  (
                    step: {
                      id: string
                      status: string
                      approvalType: string
                      comment?: string
                      actionDate?: string
                      approver?: { nameKo: string; position?: { name: string } }
                    },
                    idx: number
                  ) => (
                    <div key={step.id} className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className="w-5 shrink-0">{idx + 1}.</span>
                      <span className="flex-1 truncate">
                        {step.approver?.nameKo || '-'}{' '}
                        <span className="text-muted-foreground">({step.approver?.position?.name || '-'})</span>
                      </span>
                      <Badge
                        variant={
                          step.status === 'APPROVED'
                            ? 'default'
                            : step.status === 'REJECTED'
                              ? 'destructive'
                              : 'outline'
                        }
                        className="shrink-0 text-xs"
                      >
                        {step.status === 'APPROVED' ? '승인' : step.status === 'REJECTED' ? '반려' : '대기'}
                      </Badge>
                    </div>
                  )
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">의견</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="결재 의견을 입력하세요..."
                  className="min-h-[60px]"
                />
              </div>
              <div className="bg-background sticky bottom-0 flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => actionMutation.mutate({ id: selectedDoc.id, body: { action: 'approve', comment } })}
                  disabled={actionMutation.isPending}
                >
                  <CheckCircle className="mr-1 h-4 w-4" /> 승인
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => actionMutation.mutate({ id: selectedDoc.id, body: { action: 'reject', comment } })}
                  disabled={actionMutation.isPending}
                >
                  <XCircle className="mr-1 h-4 w-4" /> 반려
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!batchConfirm}
        onOpenChange={(open) => !open && setBatchConfirm(null)}
        title={`일괄 ${batchConfirm?.label || ''}`}
        description={`선택한 ${batchConfirm?.ids.length || 0}건을 일괄 ${batchConfirm?.label || ''}하시겠습니까?`}
        confirmLabel={batchConfirm?.label || '확인'}
        variant={batchConfirm?.action === 'reject' ? 'destructive' : 'default'}
        onConfirm={() => {
          if (batchConfirm) batchMutation.mutate({ ids: batchConfirm.ids, action: batchConfirm.action, comment: '' })
        }}
        isPending={batchMutation.isPending}
      />
    </div>
  )
}

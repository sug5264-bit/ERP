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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { CheckCircle, XCircle, CheckCheck, ArrowRight, Plus, Trash2, Send } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface LeaveRow {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: string
  createdAt: string
  employee: {
    employeeNo: string
    nameKo: string
    department: { name: string } | null
    position: { name: string } | null
  }
}

const LEAVE_TYPE_MAP: Record<string, string> = {
  ANNUAL: '연차', SICK: '병가', FAMILY: '경조사', MATERNITY: '출산', PARENTAL: '육아', OFFICIAL: '공가',
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  REQUESTED: { label: '승인대기', variant: 'outline' },
  APPROVED: { label: '승인', variant: 'default' },
  REJECTED: { label: '반려', variant: 'destructive' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

// 결재라인 기본: 담당-팀장-부문장-본부장-대표이사
const DEFAULT_APPROVAL_LINE = ['담당', '팀장', '부문장', '본부장', '대표이사']

interface ApprovalStep { approverId: string; approvalType: string; lineLabel: string }

export default function LeavePage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState<any>(null)
  const [approvalComment, setApprovalComment] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedRows, setSelectedRows] = useState<LeaveRow[]>([])
  const [actionConfirm, setActionConfirm] = useState<{ id: string; action: string; label: string; name: string } | null>(null)
  const [batchConfirm, setBatchConfirm] = useState<{ action: string; label: string; ids: string[] } | null>(null)
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>(
    DEFAULT_APPROVAL_LINE.map(label => ({ approverId: '', approvalType: 'APPROVE', lineLabel: label }))
  )
  const queryClient = useQueryClient()

  const queryParams = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-leave', statusFilter],
    queryFn: () => api.get(`/hr/leave?${queryParams.toString()}`) as Promise<any>,
  })

  const { data: empData } = useQuery({
    queryKey: ['hr-employees-list'],
    queryFn: () => api.get('/hr/employees?pageSize=500&status=ACTIVE') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/hr/leave', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave'] })
      setOpen(false)
      setApprovalSteps(DEFAULT_APPROVAL_LINE.map(label => ({ approverId: '', approvalType: 'APPROVE', lineLabel: label })))
      toast.success('휴가가 신청되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const actionMutation = useMutation({
    mutationFn: (body: { id: string; action: string; comment?: string }) => api.put('/hr/leave', body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave'] })
      const msg = variables.action === 'approve' ? '승인' : variables.action === 'reject' ? '반려' : '취소'
      toast.success(`휴가가 ${msg}되었습니다.`)
      setDetailOpen(false)
      setApprovalComment('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const batchMutation = useMutation({
    mutationFn: (body: any) => api.post('/hr/leave/batch', body) as Promise<any>,
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave'] })
      const d = res?.data || res
      toast.success(`${d.successCount}건 처리 완료${d.failCount > 0 ? `, ${d.failCount}건 실패` : ''}`)
      setSelectedRows([])
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const leaves: LeaveRow[] = data?.data || []
  const employees = empData?.data || []

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const startDate = form.get('startDate') as string
    const endDate = form.get('endDate') as string
    if (!startDate || !endDate) {
      toast.error('시작일과 종료일을 입력하세요.')
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error('종료일은 시작일 이후여야 합니다.')
      return
    }
    const diffTime = new Date(endDate).getTime() - new Date(startDate).getTime()
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    createMutation.mutate({
      employeeId: form.get('employeeId'),
      leaveType: form.get('leaveType'),
      startDate, endDate, days,
      reason: form.get('reason') || undefined,
    })
  }

  const handleAction = (id: string, action: string, name: string) => {
    const actionLabel = action === 'approve' ? '승인' : action === 'reject' ? '반려' : '취소'
    setActionConfirm({ id, action, label: actionLabel, name })
  }

  const handleBatchAction = (action: string) => {
    const pendingRows = selectedRows.filter((r) => r.status === 'REQUESTED')
    if (pendingRows.length === 0) {
      toast.error('승인대기 상태의 휴가만 일괄 처리할 수 있습니다.')
      return
    }
    const ids = pendingRows.map((r) => r.id)
    const label = action === 'approve' ? '승인' : '반려'
    setBatchConfirm({ action, label, ids })
  }

  const handleRowClick = (row: LeaveRow) => {
    setSelectedLeave(row)
    setApprovalComment('')
    setDetailOpen(true)
  }

  const addStep = () => {
    setApprovalSteps([...approvalSteps, { approverId: '', approvalType: 'APPROVE', lineLabel: '' }])
  }

  const removeStep = (idx: number) => {
    if (approvalSteps.length > 1) setApprovalSteps(approvalSteps.filter((_, i) => i !== idx))
  }

  const columns: ColumnDef<LeaveRow>[] = [
    { header: '사번', cell: ({ row }) => <span className="font-mono text-xs">{row.original.employee.employeeNo}</span> },
    { header: '이름', cell: ({ row }) => row.original.employee.nameKo },
    { header: '부서', cell: ({ row }) => row.original.employee.department?.name || '-' },
    { header: '직급', cell: ({ row }) => row.original.employee.position?.name || '-' },
    { header: '휴가유형', cell: ({ row }) => <Badge variant="outline">{LEAVE_TYPE_MAP[row.original.leaveType] || row.original.leaveType}</Badge> },
    { header: '기간', cell: ({ row }) => `${formatDate(row.original.startDate)} ~ ${formatDate(row.original.endDate)}` },
    { accessorKey: 'days', header: '일수', cell: ({ row }) => `${row.original.days}일` },
    { header: '사유', cell: ({ row }) => <span className="max-w-[150px] truncate block" title={row.original.reason || '-'}>{row.original.reason || '-'}</span> },
    { header: '상태', cell: ({ row }) => { const s = STATUS_MAP[row.original.status]; return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status } },
    {
      id: 'actions', header: '승인처리',
      cell: ({ row }) => {
        const { status, id, employee } = row.original
        if (status !== 'REQUESTED') return null
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => { e.stopPropagation(); handleAction(id, 'approve', employee.nameKo) }} disabled={actionMutation.isPending}>
              <CheckCircle className="mr-1 h-3 w-3" /> 승인
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); handleAction(id, 'reject', employee.nameKo) }} disabled={actionMutation.isPending}>
              <XCircle className="mr-1 h-3 w-3" /> 반려
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="휴가관리" description="휴가 신청 및 승인을 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="REQUESTED">승인대기</SelectItem>
            <SelectItem value="APPROVED">승인</SelectItem>
            <SelectItem value="REJECTED">반려</SelectItem>
            <SelectItem value="CANCELLED">취소</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setApprovalSteps(DEFAULT_APPROVAL_LINE.map(label => ({ approverId: '', approvalType: 'APPROVE', lineLabel: label }))) }}>
          <DialogTrigger asChild><Button>휴가 신청</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>휴가 신청</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5">
              {/* 기본정보 */}
              <div className="rounded-md border p-4 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">신청정보</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>사원 *</Label>
                    <Select name="employeeId" required>
                      <SelectTrigger><SelectValue placeholder="사원 선택" /></SelectTrigger>
                      <SelectContent>
                        {employees.map((e: any) => (<SelectItem key={e.id} value={e.id}>{e.employeeNo} - {e.nameKo}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>휴가유형 *</Label>
                    <Select name="leaveType" required>
                      <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>{Object.entries(LEAVE_TYPE_MAP).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>시작일 *</Label><Input name="startDate" type="date" required /></div>
                  <div className="space-y-2"><Label>종료일 *</Label><Input name="endDate" type="date" required /></div>
                </div>
                <div className="space-y-2"><Label>사유</Label><Textarea name="reason" placeholder="휴가 사유를 입력하세요" rows={3} /></div>
              </div>

              {/* 결재선 */}
              <div className="rounded-md border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">결재선 (담당 → 팀장 → 부문장 → 본부장 → 대표이사)</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addStep}>
                    <Plus className="mr-1 h-3 w-3" /> 결재자 추가
                  </Button>
                </div>
                {/* 결재선 시각화 */}
                <div className="flex items-center gap-1 flex-wrap">
                  {approvalSteps.map((s, idx) => (
                    <div key={`step-vis-${idx}-${s.lineLabel}`} className="flex items-center gap-1">
                      <div className={`rounded-md border px-3 py-1.5 text-xs text-center min-w-[60px] ${s.approverId ? 'bg-primary/10 border-primary/30' : 'bg-muted'}`}>
                        <div className="font-medium">{s.lineLabel || `${idx + 1}차`}</div>
                        <div className="text-muted-foreground truncate max-w-[80px]">
                          {s.approverId ? employees.find((e: any) => e.id === s.approverId)?.nameKo || '선택됨' : '미지정'}
                        </div>
                      </div>
                      {idx < approvalSteps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
                {/* 상세 설정 */}
                <div className="space-y-2">
                  {approvalSteps.map((s, idx) => (
                    <div key={`step-cfg-${idx}-${s.lineLabel}`} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
                        {s.lineLabel || `${idx + 1}차`}
                      </span>
                      <Select value={s.approverId} onValueChange={v => { const ns = [...approvalSteps]; ns[idx].approverId = v; setApprovalSteps(ns) }}>
                        <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="결재자 선택" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((e: any) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nameKo} ({e.position?.name || '-'} / {e.department?.name || '-'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={s.approvalType} onValueChange={v => { const ns = [...approvalSteps]; ns[idx].approvalType = v; setApprovalSteps(ns) }}>
                        <SelectTrigger className="w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APPROVE">결재</SelectItem>
                          <SelectItem value="REVIEW">검토</SelectItem>
                          <SelectItem value="NOTIFY">통보</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStep(idx)} disabled={approvalSteps.length <= 1} aria-label="결재자 삭제">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                <Send className="mr-1 h-4 w-4" />
                {createMutation.isPending ? '신청 중...' : '휴가 신청'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 일괄 처리 */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">{selectedRows.length}건 선택됨</span>
          <Button size="sm" onClick={() => handleBatchAction('approve')} disabled={batchMutation.isPending}>
            <CheckCheck className="mr-1 h-4 w-4" /> 일괄 승인
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleBatchAction('reject')} disabled={batchMutation.isPending}>
            <XCircle className="mr-1 h-4 w-4" /> 일괄 반려
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={leaves}
        isLoading={isLoading}
        pageSize={50}
        selectable
        onSelectionChange={(rows) => setSelectedRows(rows as LeaveRow[])}
        onRowClick={handleRowClick}
      />

      {/* 상세 / 승인처리 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>휴가 상세</DialogTitle></DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              {/* 휴가 정보 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">사원:</span> <span className="font-medium">{selectedLeave.employee.nameKo}</span></div>
                <div><span className="text-muted-foreground">사번:</span> <span className="font-mono text-xs">{selectedLeave.employee.employeeNo}</span></div>
                <div><span className="text-muted-foreground">부서:</span> {selectedLeave.employee.department?.name || '-'}</div>
                <div><span className="text-muted-foreground">직급:</span> {selectedLeave.employee.position?.name || '-'}</div>
                <div><span className="text-muted-foreground">휴가유형:</span> <Badge variant="outline">{LEAVE_TYPE_MAP[selectedLeave.leaveType] || selectedLeave.leaveType}</Badge></div>
                <div><span className="text-muted-foreground">일수:</span> {selectedLeave.days}일</div>
                <div className="col-span-2"><span className="text-muted-foreground">기간:</span> {formatDate(selectedLeave.startDate)} ~ {formatDate(selectedLeave.endDate)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">상태:</span> <Badge variant={STATUS_MAP[selectedLeave.status]?.variant || 'outline'}>{STATUS_MAP[selectedLeave.status]?.label || selectedLeave.status}</Badge></div>
              </div>

              {/* 사유 */}
              {selectedLeave.reason && (
                <div className="rounded-md border p-3">
                  <Label className="text-sm font-medium">사유</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedLeave.reason}</p>
                </div>
              )}

              {/* 결재선 시각화 */}
              <div className="rounded-md border p-4 space-y-3">
                <h4 className="text-sm font-semibold">결재선</h4>
                <div className="flex items-center gap-1 flex-wrap">
                  {DEFAULT_APPROVAL_LINE.map((label, idx) => (
                    <div key={`detail-${label}`} className="flex items-center gap-1">
                      <div className={`rounded-md border px-3 py-1.5 text-xs text-center min-w-[60px] ${
                        selectedLeave.status === 'APPROVED' ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' :
                        selectedLeave.status === 'REJECTED' ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' :
                        'bg-muted'
                      }`}>
                        <div className="font-medium">{label}</div>
                        <div className="text-muted-foreground text-[10px]">
                          {selectedLeave.status === 'APPROVED' ? '승인' : selectedLeave.status === 'REJECTED' ? '반려' : selectedLeave.status === 'REQUESTED' ? '대기' : '-'}
                        </div>
                      </div>
                      {idx < DEFAULT_APPROVAL_LINE.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* 승인/반려 */}
              {selectedLeave.status === 'REQUESTED' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">결재 의견</Label>
                    <Textarea
                      value={approvalComment}
                      onChange={e => setApprovalComment(e.target.value)}
                      placeholder="결재 의견을 입력하세요..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => handleAction(selectedLeave.id, 'approve', selectedLeave.employee.nameKo)} disabled={actionMutation.isPending}>
                      <CheckCircle className="mr-1 h-4 w-4" /> 승인
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleAction(selectedLeave.id, 'reject', selectedLeave.employee.nameKo)} disabled={actionMutation.isPending}>
                      <XCircle className="mr-1 h-4 w-4" /> 반려
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!actionConfirm}
        onOpenChange={(open) => !open && setActionConfirm(null)}
        title={`휴가 ${actionConfirm?.label || ''}`}
        description={`${actionConfirm?.name || ''}님의 휴가를 ${actionConfirm?.label || ''}하시겠습니까?`}
        confirmLabel={actionConfirm?.label || '확인'}
        variant={actionConfirm?.action === 'reject' || actionConfirm?.action === 'cancel' ? 'destructive' : 'default'}
        onConfirm={() => actionConfirm && actionMutation.mutate({ id: actionConfirm.id, action: actionConfirm.action, comment: approvalComment || undefined })}
        isPending={actionMutation.isPending}
      />

      <ConfirmDialog
        open={!!batchConfirm}
        onOpenChange={(open) => !open && setBatchConfirm(null)}
        title={`일괄 ${batchConfirm?.label || ''}`}
        description={`선택한 ${batchConfirm?.ids.length || 0}건을 일괄 ${batchConfirm?.label || ''}하시겠습니까?`}
        confirmLabel={batchConfirm?.label || '확인'}
        variant={batchConfirm?.action === 'reject' ? 'destructive' : 'default'}
        onConfirm={() => batchConfirm && batchMutation.mutate({ ids: batchConfirm.ids, action: batchConfirm.action })}
        isPending={batchMutation.isPending}
      />
    </div>
  )
}

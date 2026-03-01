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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, getLocalDateString } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Trash2, Send, FileText, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFTED: { label: '임시저장', variant: 'secondary' },
  IN_PROGRESS: { label: '결재진행', variant: 'default' },
  APPROVED: { label: '승인완료', variant: 'outline' },
  REJECTED: { label: '반려', variant: 'destructive' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

// 대기업 기준 기안서 양식 분류
const DOC_TYPES = [
  { value: 'GENERAL', label: '일반기안' },
  { value: 'EXPENDITURE', label: '지출결의서' },
  { value: 'BUSINESS_TRIP', label: '출장신청서' },
  { value: 'OVERTIME', label: '시간외근무신청서' },
  { value: 'PURCHASE', label: '구매요청서' },
  { value: 'REPORT', label: '업무보고서' },
  { value: 'COOPERATION', label: '업무협조전' },
]

// 결재라인 기본: 담당-팀장-부문장-본부장-대표이사
const DEFAULT_LINE_LABELS = ['담당', '팀장', '부문장', '본부장', '대표이사']

interface Step {
  approverId: string
  approvalType: string
  lineLabel: string
}

interface ApprovalDocRow {
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

const columns: ColumnDef<ApprovalDocRow>[] = [
  {
    accessorKey: 'documentNo',
    header: '문서번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.documentNo}</span>,
  },
  {
    header: '제목',
    accessorKey: 'title',
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
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
    header: '결재현황',
    cell: ({ row }) => {
      const { currentStep, totalSteps, status } = row.original
      if (status === 'DRAFTED') return <span className="text-muted-foreground text-sm">미상신</span>
      return (
        <span className="text-sm">
          {currentStep}/{totalSteps} 단계
        </span>
      )
    },
  },
  {
    id: 'status',
    header: '상태',
    cell: ({ row }) => {
      const s = STATUS_MAP[row.original.status]
      return <Badge variant={s?.variant || 'outline'}>{s?.label || row.original.status}</Badge>
    },
  },
]

export default function ApprovalDraftPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<ApprovalDocRow | null>(null)
  const [docType, setDocType] = useState('GENERAL')
  const [steps, setSteps] = useState<Step[]>(
    DEFAULT_LINE_LABELS.map((label) => ({ approverId: '', approvalType: 'APPROVE', lineLabel: label }))
  )
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['approval-my-drafts'],
    queryFn: () => api.get('/approval/documents?filter=myDrafts&pageSize=50'),
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => api.get('/hr/employees?pageSize=500'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/approval/documents', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-my-drafts'] })
      setOpen(false)
      resetForm()
      toast.success('기안서가 작성되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.put(`/approval/documents/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-my-drafts'] })
      setDetailOpen(false)
      toast.success('처리되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const employees = employeesData?.data || []

  const resetForm = () => {
    setDocType('GENERAL')
    setSteps(DEFAULT_LINE_LABELS.map((label) => ({ approverId: '', approvalType: 'APPROVE', lineLabel: label })))
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const validSteps = steps.filter((s) => s.approverId)
    if (validSteps.length === 0) {
      toast.error('결재자를 1명 이상 지정해주세요.')
      return
    }
    createMutation.mutate({
      title: form.get('title'),
      draftDate: form.get('draftDate'),
      urgency: form.get('urgency') || 'NORMAL',
      content: {
        docType,
        body: form.get('content'),
        department: form.get('department'),
        purpose: form.get('purpose'),
        amount: form.get('amount') || undefined,
        period: form.get('period') || undefined,
      },
      steps: validSteps.map((s) => ({ approverId: s.approverId, approvalType: s.approvalType })),
    })
  }

  const handleRowClick = async (row: ApprovalDocRow) => {
    try {
      const res = (await api.get(`/approval/documents/${row.id}`)) as Record<string, unknown>
      setSelectedDoc((res.data || res) as ApprovalDocRow)
      setDetailOpen(true)
    } catch {
      toast.error('문서를 불러올 수 없습니다.')
    }
  }

  const addStep = () => {
    setSteps([...steps, { approverId: '', approvalType: 'APPROVE', lineLabel: '' }])
  }

  const removeStep = (idx: number) => {
    if (steps.length > 1) setSteps(steps.filter((_, i) => i !== idx))
  }

  const renderDocTypeFields = () => {
    switch (docType) {
      case 'EXPENDITURE':
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  지출목적 <span className="text-destructive">*</span>
                </Label>
                <Input name="purpose" required aria-required="true" placeholder="지출 목적을 입력하세요" />
              </div>
              <div className="space-y-2">
                <Label>지출금액 (원)</Label>
                <Input name="amount" type="number" placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상세내용</Label>
              <Textarea name="content" rows={6} placeholder="지출 상세 내용을 기재해주세요" />
            </div>
          </>
        )
      case 'BUSINESS_TRIP':
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  출장목적 <span className="text-destructive">*</span>
                </Label>
                <Input name="purpose" required aria-required="true" placeholder="출장 목적" />
              </div>
              <div className="space-y-2">
                <Label>출장기간</Label>
                <Input name="period" placeholder="2025-01-01 ~ 2025-01-03" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상세내용</Label>
              <Textarea name="content" rows={6} placeholder="출장 일정 및 방문처 등을 기재해주세요" />
            </div>
          </>
        )
      case 'OVERTIME':
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  근무사유 <span className="text-destructive">*</span>
                </Label>
                <Input name="purpose" required aria-required="true" placeholder="시간외 근무 사유" />
              </div>
              <div className="space-y-2">
                <Label>근무시간</Label>
                <Input name="period" placeholder="18:00 ~ 22:00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상세내용</Label>
              <Textarea name="content" rows={4} placeholder="업무 내용을 기재해주세요" />
            </div>
          </>
        )
      case 'PURCHASE':
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  구매목적 <span className="text-destructive">*</span>
                </Label>
                <Input name="purpose" required aria-required="true" placeholder="구매 목적" />
              </div>
              <div className="space-y-2">
                <Label>예상금액 (원)</Label>
                <Input name="amount" type="number" placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상세내용</Label>
              <Textarea name="content" rows={6} placeholder="구매 품목 및 수량, 납품일정 등을 기재해주세요" />
            </div>
          </>
        )
      case 'REPORT':
        return (
          <>
            <div className="space-y-2">
              <Label>
                보고목적 <span className="text-destructive">*</span>
              </Label>
              <Input name="purpose" required aria-required="true" placeholder="보고 주제" />
            </div>
            <div className="space-y-2">
              <Label>보고내용</Label>
              <Textarea name="content" rows={8} placeholder="보고 내용을 상세히 기재해주세요" />
            </div>
          </>
        )
      case 'COOPERATION':
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>협조요청부서</Label>
                <Input name="department" placeholder="요청 부서명" />
              </div>
              <div className="space-y-2">
                <Label>
                  협조사항 <span className="text-destructive">*</span>
                </Label>
                <Input name="purpose" required aria-required="true" placeholder="협조 요청 사항" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상세내용</Label>
              <Textarea name="content" rows={6} placeholder="협조 내용을 기재해주세요" />
            </div>
          </>
        )
      default: // GENERAL
        return (
          <>
            <div className="space-y-2">
              <Label>기안목적</Label>
              <Input name="purpose" placeholder="기안 목적" />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea name="content" rows={8} placeholder="기안 내용을 작성해주세요" />
            </div>
          </>
        )
    }
  }

  const getStepStatusIcon = (status: string) => {
    if (status === 'APPROVED') return <CheckCircle2 className="text-status-success h-4 w-4" />
    if (status === 'REJECTED') return <XCircle className="text-destructive h-4 w-4" />
    return <Clock className="text-muted-foreground h-4 w-4" />
  }

  return (
    <div className="space-y-6">
      <PageHeader title="기안하기" description="새로운 결재 문서를 작성하고 관리합니다" />

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <FileText className="mr-1 h-4 w-4" /> 신규 기안
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>기안서 작성</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5">
              {/* 기본정보 */}
              <div className="space-y-4 rounded-md border p-4">
                <h3 className="text-muted-foreground text-sm font-semibold">기본정보</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>
                      문서유형 <span className="text-destructive">*</span>
                    </Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      기안일 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      name="draftDate"
                      type="date"
                      required
                      aria-required="true"
                      defaultValue={getLocalDateString()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>긴급도</Label>
                    <Select name="urgency" defaultValue="NORMAL">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">일반</SelectItem>
                        <SelectItem value="URGENT">긴급</SelectItem>
                        <SelectItem value="EMERGENCY">초긴급</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>
                    제목 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="title" required aria-required="true" placeholder="기안서 제목을 입력하세요" />
                </div>
              </div>

              {/* 기안내용 - 문서유형별 */}
              <div className="space-y-4 rounded-md border p-4">
                <h3 className="text-muted-foreground text-sm font-semibold">기안내용</h3>
                {renderDocTypeFields()}
              </div>

              {/* 결재선 */}
              <div className="space-y-4 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-muted-foreground text-sm font-semibold">
                    결재선 (담당 → 팀장 → 부문장 → 본부장 → 대표이사)
                  </h3>
                  <Button type="button" variant="outline" size="sm" onClick={addStep}>
                    <Plus className="mr-1 h-3 w-3" /> 결재자 추가
                  </Button>
                </div>
                {/* 결재선 시각화 */}
                <div className="flex flex-wrap items-center gap-1">
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <div
                        className={`min-w-[60px] rounded-md border px-3 py-1.5 text-center text-xs ${s.approverId ? 'bg-primary/10 border-primary/30' : 'bg-muted'}`}
                      >
                        <div className="font-medium">{s.lineLabel || `${idx + 1}차`}</div>
                        <div className="text-muted-foreground max-w-[80px] truncate">
                          {s.approverId
                            ? employees.find((e: { id: string; nameKo: string }) => e.id === s.approverId)?.nameKo ||
                              '선택됨'
                            : '미지정'}
                        </div>
                      </div>
                      {idx < steps.length - 1 && <ArrowRight className="text-muted-foreground h-3 w-3" />}
                    </div>
                  ))}
                </div>
                {/* 상세 설정 */}
                <div className="space-y-2">
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16 shrink-0 text-xs font-medium">
                        {s.lineLabel || `${idx + 1}차`}
                      </span>
                      <Select
                        value={s.approverId}
                        onValueChange={(v) => {
                          const ns = [...steps]
                          ns[idx].approverId = v
                          setSteps(ns)
                        }}
                      >
                        <SelectTrigger className="flex-1 text-xs">
                          <SelectValue placeholder="결재자 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(
                            (e: {
                              id: string
                              nameKo: string
                              position?: { name: string } | null
                              department?: { name: string } | null
                            }) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.nameKo} ({e.position?.name || '-'} / {e.department?.name || '-'})
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <Select
                        value={s.approvalType}
                        onValueChange={(v) => {
                          const ns = [...steps]
                          ns[idx].approvalType = v
                          setSteps(ns)
                        }}
                      >
                        <SelectTrigger className="w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APPROVE">결재</SelectItem>
                          <SelectItem value="REVIEW">검토</SelectItem>
                          <SelectItem value="NOTIFY">통보</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeStep(idx)}
                        disabled={steps.length <= 1}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                  <Send className="mr-1 h-4 w-4" />
                  {createMutation.isPending ? '작성 중...' : '기안 작성 (임시저장)'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
      />

      {/* 상세 다이얼로그 */}
      <Dialog
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v)
          if (!v) setSelectedDoc(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.title}</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              {/* 문서정보 */}
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">문서번호:</span>{' '}
                  <span className="font-mono">{selectedDoc.documentNo}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">기안일:</span> {formatDate(selectedDoc.draftDate)}
                </div>
                <div>
                  <span className="text-muted-foreground">기안자:</span> {selectedDoc.drafter?.nameKo}
                </div>
                <div>
                  <span className="text-muted-foreground">상태:</span>{' '}
                  <Badge variant={STATUS_MAP[selectedDoc.status]?.variant || 'outline'}>
                    {STATUS_MAP[selectedDoc.status]?.label || selectedDoc.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">긴급도:</span>{' '}
                  {selectedDoc.urgency === 'NORMAL' ? '일반' : selectedDoc.urgency === 'URGENT' ? '긴급' : '초긴급'}
                </div>
                {selectedDoc.content?.docType && (
                  <div>
                    <span className="text-muted-foreground">문서유형:</span>{' '}
                    {DOC_TYPES.find((t) => t.value === selectedDoc.content?.docType)?.label ||
                      selectedDoc.content?.docType}
                  </div>
                )}
              </div>

              {/* 기안내용 */}
              <div className="space-y-2 rounded-md border p-4">
                <h4 className="text-sm font-semibold">기안내용</h4>
                {selectedDoc.content?.purpose && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">목적:</span> {selectedDoc.content.purpose}
                  </div>
                )}
                {selectedDoc.content?.amount && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">금액:</span>{' '}
                    {Number(selectedDoc.content.amount).toLocaleString()}원
                  </div>
                )}
                {selectedDoc.content?.period && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">기간:</span> {selectedDoc.content.period}
                  </div>
                )}
                {selectedDoc.content?.department && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">부서:</span> {selectedDoc.content.department}
                  </div>
                )}
                <div className="bg-muted/30 mt-2 rounded-md border p-3 text-sm whitespace-pre-wrap">
                  {selectedDoc.content?.body || '-'}
                </div>
              </div>

              {/* 결재선 */}
              <div className="space-y-3 rounded-md border p-4">
                <h4 className="text-sm font-semibold">결재선</h4>
                <div className="space-y-2">
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
                      <div key={step.id} className="flex items-center gap-3 border-b py-1 text-sm last:border-0">
                        <span className="text-muted-foreground w-6 text-center font-medium">{idx + 1}</span>
                        {getStepStatusIcon(step.status)}
                        <span className="flex-1 font-medium">
                          {step.approver?.nameKo || '-'}
                          <span className="text-muted-foreground ml-1 font-normal">
                            ({step.approver?.position?.name || '-'})
                          </span>
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {step.approvalType === 'APPROVE' ? '결재' : step.approvalType === 'REVIEW' ? '검토' : '통보'}
                        </Badge>
                        <Badge
                          variant={
                            step.status === 'APPROVED'
                              ? 'default'
                              : step.status === 'REJECTED'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {step.status === 'APPROVED' ? '승인' : step.status === 'REJECTED' ? '반려' : '대기'}
                        </Badge>
                        {step.comment && (
                          <span className="text-muted-foreground max-w-[100px] truncate text-xs" title={step.comment}>
                            "{step.comment}"
                          </span>
                        )}
                        {step.actionDate && (
                          <span className="text-muted-foreground text-xs">{formatDate(step.actionDate)}</span>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* 액션 버튼 */}
              {selectedDoc.status === 'DRAFTED' && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => actionMutation.mutate({ id: selectedDoc.id, body: { action: 'submit' } })}
                    disabled={actionMutation.isPending}
                  >
                    <Send className="mr-1 h-4 w-4" /> 상신 (결재 요청)
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => actionMutation.mutate({ id: selectedDoc.id, body: { action: 'cancel' } })}
                    disabled={actionMutation.isPending}
                  >
                    취소
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

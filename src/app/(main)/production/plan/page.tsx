'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { SummaryCards } from '@/components/common/summary-cards'
import { PermissionGuard } from '@/components/common/permission-guard'
import { formatDate, getLocalDateString } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { PRODUCTION_STATUS_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, ClipboardList, Loader2, CheckCircle, ListChecks } from 'lucide-react'

interface ProductionPlan {
  id: string
  planNo: string
  planDate: string
  bomName: string
  oemContractName: string | null
  plannedQty: number
  plannedDate: string
  status: string
}

interface BomOption {
  id: string
  bomName: string
  bomCode: string
}

interface OemOption {
  id: string
  contractName: string
  contractNo: string
}

const columns: ColumnDef<ProductionPlan>[] = [
  {
    accessorKey: 'planNo',
    header: '계획번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.planNo}</span>,
  },
  {
    accessorKey: 'planDate',
    header: '계획일',
    cell: ({ row }) => formatDate(row.original.planDate),
  },
  {
    accessorKey: 'bomName',
    header: '배합표명',
    cell: ({ row }) => <span className="font-medium">{row.original.bomName}</span>,
  },
  {
    accessorKey: 'oemContractName',
    header: 'OEM계약',
    cell: ({ row }) => row.original.oemContractName || '-',
  },
  {
    accessorKey: 'plannedQty',
    header: '계획수량',
    cell: ({ row }) => <span className="tabular-nums">{row.original.plannedQty?.toLocaleString()}</span>,
  },
  {
    accessorKey: 'plannedDate',
    header: '예정일',
    cell: ({ row }) => formatDate(row.original.plannedDate),
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={PRODUCTION_STATUS_LABELS} />,
  },
]

export default function ProductionPlanPage() {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // 계획 등록 상태
  const [createOpen, setCreateOpen] = useState(false)
  const [formPlanDate, setFormPlanDate] = useState(getLocalDateString())
  const [formBomHeaderId, setFormBomHeaderId] = useState('')
  const [formOemContractId, setFormOemContractId] = useState('')
  const [formPlannedQty, setFormPlannedQty] = useState(1)
  const [formPlannedDate, setFormPlannedDate] = useState('')
  const [formDescription, setFormDescription] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['production-plan', startDate, endDate, statusFilter],
    queryFn: () => api.get(`/production/plan?${qp.toString()}`),
  })

  // BOM 목록 조회 (등록 다이얼로그 열릴 때만)
  const { data: bomData } = useQuery({
    queryKey: ['bom-list-active'],
    queryFn: () => api.get('/production/bom?pageSize=200'),
    enabled: createOpen,
  })
  const bomOptions: BomOption[] = (bomData?.data || []).map((b: Record<string, unknown>) => ({
    id: String(b.id),
    bomName: String(b.bomName),
    bomCode: String(b.bomCode),
  }))

  // OEM 계약 목록 조회
  const { data: oemData } = useQuery({
    queryKey: ['oem-list-active'],
    queryFn: () => api.get('/production/oem?status=ACTIVE'),
    enabled: createOpen,
  })
  const oemOptions: OemOption[] = (oemData?.data || []).map((o: Record<string, unknown>) => ({
    id: String(o.id),
    contractName: String(o.contractName),
    contractNo: String(o.contractNo),
  }))

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/production/plan', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-plan'] })
      setCreateOpen(false)
      resetCreateForm()
      toast.success('생산계획이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message || '생산계획 등록에 실패했습니다.'),
  })

  const resetCreateForm = () => {
    setFormPlanDate(getLocalDateString())
    setFormBomHeaderId('')
    setFormOemContractId('')
    setFormPlannedQty(1)
    setFormPlannedDate('')
    setFormDescription('')
  }

  const handleCreateSubmit = () => {
    if (!formPlanDate || !formBomHeaderId || !formPlannedDate) {
      toast.error('계획일, 배합표, 생산예정일을 입력하세요.')
      return
    }
    if (formPlannedQty < 1) {
      toast.error('계획수량은 1 이상이어야 합니다.')
      return
    }
    createMutation.mutate({
      planDate: formPlanDate,
      bomHeaderId: formBomHeaderId,
      oemContractId: formOemContractId || undefined,
      plannedQty: formPlannedQty,
      plannedDate: formPlannedDate,
      description: formDescription || undefined,
    })
  }

  const items = (data?.data || []) as ProductionPlan[]

  const exportColumns: ExportColumn[] = [
    { header: '계획번호', accessor: 'planNo' },
    { header: '계획일', accessor: (r) => formatDate(r.planDate) },
    { header: '배합표명', accessor: 'bomName' },
    { header: 'OEM계약', accessor: (r) => r.oemContractName || '-' },
    { header: '계획수량', accessor: (r) => r.plannedQty?.toLocaleString() },
    { header: '예정일', accessor: (r) => formatDate(r.plannedDate) },
    { header: '상태', accessor: (r) => PRODUCTION_STATUS_LABELS[r.status] || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '생산계획', title: '생산계획 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const totalCount = items.length
  const plannedCount = items.filter((i) => i.status === 'PLANNED').length
  const inProgressCount = items.filter((i) => i.status === 'IN_PROGRESS').length
  const completedCount = items.filter((i) => i.status === 'COMPLETED').length

  const summaryItems = [
    { label: '전체', value: totalCount, icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: '계획', value: plannedCount, icon: ListChecks, color: 'text-violet-600', bgColor: 'bg-violet-50' },
    { label: '진행중', value: inProgressCount, icon: Loader2, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: '완료', value: completedCount, icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="생산계획"
        description="생산 계획을 수립하고 관리합니다"
        actions={
          <PermissionGuard module="production" action="create">
            <Button size="sm" onClick={() => { resetCreateForm(); setCreateOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" /> 계획 등록
            </Button>
          </PermissionGuard>
        }
      />

      <SummaryCards items={summaryItems} isLoading={isLoading} />

      <div className="flex flex-wrap items-end gap-2">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(PRODUCTION_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="계획번호, 배합표 검색..."
        searchColumn="planNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />

      {/* 생산계획 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreateForm() }}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>생산계획 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>계획일 <span className="text-destructive">*</span></Label>
                <Input type="date" value={formPlanDate} onChange={(e) => setFormPlanDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>생산예정일 <span className="text-destructive">*</span></Label>
                <Input type="date" value={formPlannedDate} onChange={(e) => setFormPlannedDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>배합표 <span className="text-destructive">*</span></Label>
              <Select value={formBomHeaderId} onValueChange={setFormBomHeaderId}>
                <SelectTrigger><SelectValue placeholder="배합표 선택" /></SelectTrigger>
                <SelectContent>
                  {bomOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.bomName} ({b.bomCode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>OEM 계약 (선택)</Label>
              <Select value={formOemContractId} onValueChange={setFormOemContractId}>
                <SelectTrigger><SelectValue placeholder="OEM 계약 선택 (선택사항)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안함</SelectItem>
                  {oemOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.contractName} ({o.contractNo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>계획수량 <span className="text-destructive">*</span></Label>
              <Input type="number" min={1} value={formPlannedQty} onChange={(e) => setFormPlannedQty(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>비고</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="비고 사항을 입력하세요" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '계획 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

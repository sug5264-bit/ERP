'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { SummaryCards } from '@/components/common/summary-cards'
import { PermissionGuard } from '@/components/common/permission-guard'
import { formatDate, getLocalDateString } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Package, AlertTriangle, BarChart3, Plus } from 'lucide-react'

interface ProductionResult {
  id: string
  resultNo: string
  productionDate: string
  planNo: string
  producedQty: number
  defectQty: number
  goodQty: number
  lotNo: string
}

interface PlanOption {
  id: string
  planNo: string
  bomName: string
}

const columns: ColumnDef<ProductionResult>[] = [
  {
    accessorKey: 'resultNo',
    header: '실적번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.resultNo}</span>,
  },
  {
    accessorKey: 'productionDate',
    header: '생산일',
    cell: ({ row }) => formatDate(row.original.productionDate),
  },
  {
    accessorKey: 'planNo',
    header: '계획번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.planNo}</span>,
  },
  {
    accessorKey: 'producedQty',
    header: '생산수량',
    cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.producedQty?.toLocaleString()}</span>,
  },
  {
    accessorKey: 'defectQty',
    header: '불량수량',
    cell: ({ row }) => (
      <span className={`tabular-nums ${row.original.defectQty > 0 ? 'font-medium text-red-600' : ''}`}>
        {row.original.defectQty?.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'goodQty',
    header: '양품수량',
    cell: ({ row }) => <span className="text-green-600 tabular-nums">{row.original.goodQty?.toLocaleString()}</span>,
  },
  {
    accessorKey: 'lotNo',
    header: 'LOT번호',
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-xs">
        {row.original.lotNo || '-'}
      </Badge>
    ),
  },
]

export default function ProductionResultPage() {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 실적 등록 상태
  const [createOpen, setCreateOpen] = useState(false)
  const [formProductionDate, setFormProductionDate] = useState(getLocalDateString())
  const [formPlanId, setFormPlanId] = useState('')
  const [formProducedQty, setFormProducedQty] = useState(0)
  const [formDefectQty, setFormDefectQty] = useState(0)
  const [formLotNo, setFormLotNo] = useState('')
  const [formExpiryDate, setFormExpiryDate] = useState('')
  const [formRemarks, setFormRemarks] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['production-result', startDate, endDate],
    queryFn: () => api.get(`/production/result?${qp.toString()}`),
  })

  // 생산계획 목록 (등록 다이얼로그 열릴 때만)
  const { data: planData } = useQuery({
    queryKey: ['production-plans-for-result'],
    queryFn: () => api.get('/production/plan?pageSize=200&status=IN_PROGRESS'),
    enabled: createOpen,
  })
  const planOptions: PlanOption[] = (planData?.data || []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    planNo: String(p.planNo),
    bomName: String(p.bomName),
  }))

  // Also include PLANNED status plans
  const { data: plannedData } = useQuery({
    queryKey: ['production-plans-planned'],
    queryFn: () => api.get('/production/plan?pageSize=200&status=PLANNED'),
    enabled: createOpen,
  })
  const allPlanOptions: PlanOption[] = [
    ...planOptions,
    ...(plannedData?.data || []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      planNo: String(p.planNo),
      bomName: String(p.bomName),
    })),
  ]

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/production/result', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-result'] })
      setCreateOpen(false)
      resetCreateForm()
      toast.success('생산실적이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message || '생산실적 등록에 실패했습니다.'),
  })

  const resetCreateForm = () => {
    setFormProductionDate(getLocalDateString())
    setFormPlanId('')
    setFormProducedQty(0)
    setFormDefectQty(0)
    setFormLotNo('')
    setFormExpiryDate('')
    setFormRemarks('')
  }

  const handleCreateSubmit = () => {
    if (!formProductionDate || !formPlanId) {
      toast.error('생산일과 생산계획을 선택하세요.')
      return
    }
    if (formProducedQty < 1) {
      toast.error('생산수량은 1 이상이어야 합니다.')
      return
    }
    if (formDefectQty > formProducedQty) {
      toast.error('불량수량이 생산수량을 초과할 수 없습니다.')
      return
    }
    createMutation.mutate({
      productionPlanId: formPlanId,
      productionDate: formProductionDate,
      producedQty: formProducedQty,
      defectQty: formDefectQty,
      lotNo: formLotNo || undefined,
      expiryDate: formExpiryDate || undefined,
      remarks: formRemarks || undefined,
    })
  }

  const items = (data?.data || []) as ProductionResult[]

  const exportColumns: ExportColumn[] = [
    { header: '실적번호', accessor: 'resultNo' },
    { header: '생산일', accessor: (r) => formatDate(r.productionDate) },
    { header: '계획번호', accessor: 'planNo' },
    { header: '생산수량', accessor: (r) => r.producedQty?.toLocaleString() },
    { header: '불량수량', accessor: (r) => r.defectQty?.toLocaleString() },
    { header: '양품수량', accessor: (r) => r.goodQty?.toLocaleString() },
    { header: 'LOT번호', accessor: (r) => r.lotNo || '-' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '생산실적', title: '생산실적 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const totalProduced = items.reduce((sum, i) => sum + (i.producedQty || 0), 0)
  const totalDefect = items.reduce((sum, i) => sum + (i.defectQty || 0), 0)
  const defectRate = totalProduced > 0 ? ((totalDefect / totalProduced) * 100).toFixed(1) : '0.0'

  const summaryItems = [
    {
      label: '총생산',
      value: totalProduced.toLocaleString(),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '총불량',
      value: totalDefect.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    { label: '불량률', value: `${defectRate}%`, icon: BarChart3, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="생산실적"
        description="생산 실적을 기록하고 조회합니다"
        actions={
          <PermissionGuard module="production" action="create">
            <Button size="sm" onClick={() => { resetCreateForm(); setCreateOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" /> 실적 등록
            </Button>
          </PermissionGuard>
        }
      />

      <SummaryCards items={summaryItems} isLoading={isLoading} />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => {
          setStartDate(s)
          setEndDate(e)
        }}
      />

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="실적번호, 계획번호, LOT 검색..."
        searchColumn="resultNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />

      {/* 생산실적 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreateForm() }}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>생산실적 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>생산일 <span className="text-destructive">*</span></Label>
                <Input type="date" value={formProductionDate} onChange={(e) => setFormProductionDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>생산계획 <span className="text-destructive">*</span></Label>
                <Select value={formPlanId} onValueChange={setFormPlanId}>
                  <SelectTrigger><SelectValue placeholder="생산계획 선택" /></SelectTrigger>
                  <SelectContent>
                    {allPlanOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.planNo} - {p.bomName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>생산수량 <span className="text-destructive">*</span></Label>
                <Input type="number" min={1} value={formProducedQty} onChange={(e) => setFormProducedQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>불량수량</Label>
                <Input type="number" min={0} value={formDefectQty} onChange={(e) => setFormDefectQty(Number(e.target.value))} />
              </div>
            </div>
            {formProducedQty > 0 && (
              <div className="bg-muted/50 rounded-md p-2 text-sm">
                양품수량: <span className="font-medium text-green-600">{(formProducedQty - formDefectQty).toLocaleString()}</span>
                {formDefectQty > 0 && (
                  <span className="ml-3">
                    불량률: <span className="font-medium text-red-600">{((formDefectQty / formProducedQty) * 100).toFixed(1)}%</span>
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>LOT번호</Label>
                <Input value={formLotNo} onChange={(e) => setFormLotNo(e.target.value)} placeholder="LOT-2024-001" />
              </div>
              <div className="space-y-2">
                <Label>유통기한</Label>
                <Input type="date" value={formExpiryDate} onChange={(e) => setFormExpiryDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>비고</Label>
              <Textarea value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} placeholder="비고 사항을 입력하세요" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '실적 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

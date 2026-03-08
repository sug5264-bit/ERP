'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { StatusBadge } from '@/components/common/status-badge'
import { PermissionGuard } from '@/components/common/permission-guard'
import { formatDate } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { OEM_CONTRACT_STATUS_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'

interface PartnerOption {
  id: string
  partnerName: string
}

interface OemContract {
  id: string
  contractNo: string
  contractName: string
  partnerId: string
  manufacturerName: string
  startDate: string
  endDate: string
  minOrderQty: number
  leadTimeDays: number
  status: string
}

const columns: ColumnDef<OemContract>[] = [
  {
    accessorKey: 'contractNo',
    header: '계약번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.contractNo}</span>,
  },
  {
    accessorKey: 'contractName',
    header: '계약명',
    cell: ({ row }) => <span className="font-medium">{row.original.contractName}</span>,
  },
  {
    accessorKey: 'manufacturerName',
    header: '제조사',
  },
  {
    id: 'period',
    header: '계약기간',
    cell: ({ row }) => (
      <span className="text-xs">
        {formatDate(row.original.startDate)} ~ {formatDate(row.original.endDate)}
      </span>
    ),
  },
  {
    accessorKey: 'minOrderQty',
    header: '최소발주량',
    cell: ({ row }) => <span className="tabular-nums">{row.original.minOrderQty?.toLocaleString() || '-'}</span>,
  },
  {
    accessorKey: 'leadTimeDays',
    header: '리드타임',
    cell: ({ row }) => (row.original.leadTimeDays ? `${row.original.leadTimeDays}일` : '-'),
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={OEM_CONTRACT_STATUS_LABELS} />,
  },
]

function OemForm({
  contract,
  partners,
  onSubmit,
  isPending,
}: {
  contract?: OemContract | null
  partners: PartnerOption[]
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isPending: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            계약번호 <span className="text-destructive">*</span>
          </Label>
          <Input
            name="contractNo"
            required
            defaultValue={contract?.contractNo || ''}
            disabled={!!contract}
            className={contract ? 'bg-muted' : ''}
            placeholder="OEM-001"
          />
        </div>
        <div className="space-y-2">
          <Label>
            계약명 <span className="text-destructive">*</span>
          </Label>
          <Input name="contractName" required defaultValue={contract?.contractName || ''} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            제조사 <span className="text-destructive">*</span>
          </Label>
          <Select name="partnerId" defaultValue={contract?.partnerId || ''} required>
            <SelectTrigger>
              <SelectValue placeholder="제조사 선택" />
            </SelectTrigger>
            <SelectContent>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>상태</Label>
          <Select name="status" defaultValue={contract?.status || 'DRAFT'}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OEM_CONTRACT_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>계약시작일</Label>
          <Input name="startDate" type="date" defaultValue={contract?.startDate?.slice(0, 10) || ''} />
        </div>
        <div className="space-y-2">
          <Label>계약종료일</Label>
          <Input name="endDate" type="date" defaultValue={contract?.endDate?.slice(0, 10) || ''} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>최소발주량</Label>
          <Input name="minOrderQty" type="number" defaultValue={contract?.minOrderQty || ''} />
        </div>
        <div className="space-y-2">
          <Label>리드타임 (일)</Label>
          <Input name="leadTimeDays" type="number" defaultValue={contract?.leadTimeDays || ''} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (contract ? '수정 중...' : '등록 중...') : contract ? '수정' : '등록'}
      </Button>
    </form>
  )
}

export default function OemPage() {
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<OemContract | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()

  const { data: partnersData } = useQuery({
    queryKey: ['oem-partners'],
    queryFn: () => api.get('/partners?partnerType=PURCHASE&pageSize=200'),
    enabled: open || !!editTarget,
  })
  const partners: PartnerOption[] = (partnersData?.data || []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    partnerName: String(p.partnerName),
  }))

  const qp = new URLSearchParams()
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['production-oem', statusFilter],
    queryFn: () => api.get(`/production/oem?${qp.toString()}`),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/production/oem', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-oem'] })
      setOpen(false)
      toast.success('OEM 계약이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/production/oem/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-oem'] })
      setEditTarget(null)
      toast.success('OEM 계약이 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      contractNo: form.get('contractNo'),
      contractName: form.get('contractName'),
      partnerId: form.get('partnerId'),
      status: form.get('status'),
      startDate: form.get('startDate') || undefined,
      endDate: form.get('endDate') || undefined,
      minimumOrderQty: form.get('minOrderQty') ? parseInt(form.get('minOrderQty') as string) : undefined,
      leadTimeDays: form.get('leadTimeDays') ? parseInt(form.get('leadTimeDays') as string) : undefined,
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      contractName: form.get('contractName'),
      partnerId: form.get('partnerId'),
      status: form.get('status'),
      startDate: form.get('startDate') || undefined,
      endDate: form.get('endDate') || undefined,
      minimumOrderQty: form.get('minOrderQty') ? parseInt(form.get('minOrderQty') as string) : undefined,
      leadTimeDays: form.get('leadTimeDays') ? parseInt(form.get('leadTimeDays') as string) : undefined,
    })
  }

  const items = (data?.data || []) as OemContract[]

  const exportColumns: ExportColumn[] = [
    { header: '계약번호', accessor: 'contractNo' },
    { header: '계약명', accessor: 'contractName' },
    { header: '제조사', accessor: 'manufacturerName' },
    { header: '계약시작일', accessor: (r) => formatDate(r.startDate) },
    { header: '계약종료일', accessor: (r) => formatDate(r.endDate) },
    { header: '최소발주량', accessor: (r) => r.minOrderQty?.toLocaleString() || '-' },
    { header: '리드타임(일)', accessor: (r) => r.leadTimeDays ? `${r.leadTimeDays}일` : '-' },
    { header: '상태', accessor: (r) => OEM_CONTRACT_STATUS_LABELS[r.status] || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: 'OEM위탁현황', title: 'OEM 위탁현황 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="OEM 위탁현황"
        description="OEM 위탁 생산 계약을 등록하고 관리합니다"
        actions={
          <PermissionGuard module="production" action="create">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> OEM 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>OEM 계약 등록</DialogTitle>
                </DialogHeader>
                <OemForm partners={partners} onSubmit={handleCreate} isPending={createMutation.isPending} />
              </DialogContent>
            </Dialog>
          </PermissionGuard>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(OEM_CONTRACT_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={[
          ...columns,
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <PermissionGuard module="production" action="update">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditTarget(row.original)}
                  aria-label="수정"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </PermissionGuard>
            ),
            size: 60,
          },
        ]}
        data={items}
        searchPlaceholder="계약번호, 계약명, 제조사 검색..."
        searchColumn="contractName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />

      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>OEM 계약 수정</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <OemForm
              key={editTarget.id}
              contract={editTarget}
              partners={partners}
              onSubmit={handleUpdate}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

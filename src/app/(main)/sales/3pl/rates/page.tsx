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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const SHIPPING_METHOD_MAP: Record<string, string> = {
  PARCEL: '택배',
  EXPRESS: '퀵배송',
  FREIGHT: '화물',
  DIRECT: '직배',
}

interface ShipperOption {
  id: string
  companyName: string
}

interface RateRow {
  id: string
  shipperId: string
  shipper: { companyName: string }
  rateName: string
  regionCode: string | null
  regionName: string | null
  weightMin: number | null
  weightMax: number | null
  baseRate: number
  surchargeRate: number | null
  shippingMethod: string
  effectiveFrom: string | null
  effectiveTo: string | null
  isActive: boolean
  memo: string | null
}

const columns: ColumnDef<RateRow>[] = [
  {
    id: 'shipperName',
    header: '화주사',
    cell: ({ row }) => <span className="font-medium">{row.original.shipper?.companyName || '-'}</span>,
  },
  { accessorKey: 'rateName', header: '요율명' },
  { id: 'regionName', header: '권역', cell: ({ row }) => row.original.regionName || '-' },
  {
    id: 'weightRange',
    header: '중량범위',
    cell: ({ row }) => {
      const min = row.original.weightMin
      const max = row.original.weightMax
      if (min == null && max == null) return '-'
      return `${min ?? 0}~${max ?? ''}kg`
    },
  },
  {
    id: 'baseRate',
    header: '기본요율',
    cell: ({ row }) => formatCurrency(row.original.baseRate),
  },
  {
    id: 'surchargeRate',
    header: '부가요율',
    cell: ({ row }) => (row.original.surchargeRate ? formatCurrency(row.original.surchargeRate) : '-'),
  },
  {
    id: 'shippingMethod',
    header: '배송방법',
    cell: ({ row }) => (
      <Badge variant="outline">{SHIPPING_METHOD_MAP[row.original.shippingMethod] || row.original.shippingMethod}</Badge>
    ),
  },
  {
    id: 'effectivePeriod',
    header: '적용기간',
    cell: ({ row }) => {
      const from = row.original.effectiveFrom
      const to = row.original.effectiveTo
      if (!from && !to) return '-'
      return `${from || ''}~${to || ''}`
    },
  },
  {
    id: 'status',
    header: '상태',
    cell: ({ row }) => (
      <Badge
        variant={row.original.isActive ? 'default' : 'secondary'}
        className={row.original.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'}
      >
        {row.original.isActive ? '활성' : '비활성'}
      </Badge>
    ),
  },
]

export default function RatesPage() {
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RateRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [shipperFilter, setShipperFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const queryClient = useQueryClient()

  const { data: shippersData } = useQuery({
    queryKey: ['3pl-shippers'],
    queryFn: () => api.get('/sales/3pl/shippers') as Promise<{ data: ShipperOption[] }>,
  })
  const shipperOptions: ShipperOption[] = shippersData?.data || []

  const qp = new URLSearchParams()
  if (shipperFilter && shipperFilter !== 'all') qp.set('shipperId', shipperFilter)
  if (methodFilter && methodFilter !== 'all') qp.set('shippingMethod', methodFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['3pl-rates', shipperFilter, methodFilter],
    queryFn: () => api.get(`/sales/3pl/rates?${qp.toString()}`) as Promise<{ data: RateRow[] }>,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/3pl/rates', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['3pl-rates'] })
      setOpen(false)
      toast.success('요율이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/sales/3pl/rates/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['3pl-rates'] })
      setEditTarget(null)
      toast.success('요율 정보가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/3pl/rates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['3pl-rates'] })
      toast.success('요율이 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rates: RateRow[] = data?.data || []

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>, id?: string) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      shipperId: form.get('shipperId'),
      rateName: form.get('rateName'),
      regionCode: form.get('regionCode') || undefined,
      regionName: form.get('regionName') || undefined,
      weightMin: form.get('weightMin') ? parseFloat(form.get('weightMin') as string) : undefined,
      weightMax: form.get('weightMax') ? parseFloat(form.get('weightMax') as string) : undefined,
      baseRate: parseFloat(form.get('baseRate') as string),
      surchargeRate: form.get('surchargeRate') ? parseFloat(form.get('surchargeRate') as string) : undefined,
      shippingMethod: form.get('shippingMethod') || 'PARCEL',
      effectiveFrom: form.get('effectiveFrom') || undefined,
      effectiveTo: form.get('effectiveTo') || undefined,
      isActive: form.get('isActive') === 'true',
      memo: form.get('memo') || undefined,
    }
    if (id) {
      updateMutation.mutate({ id, ...body })
    } else {
      createMutation.mutate(body)
    }
  }

  const renderForm = (target?: RateRow) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>
          화주사 <span className="text-destructive">*</span>
        </Label>
        <Select name="shipperId" defaultValue={target?.shipperId || ''} required>
          <SelectTrigger>
            <SelectValue placeholder="화주사 선택" />
          </SelectTrigger>
          <SelectContent>
            {shipperOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>
          요율명 <span className="text-destructive">*</span>
        </Label>
        <Input name="rateName" required aria-required="true" defaultValue={target?.rateName || ''} />
      </div>
      <div className="space-y-2">
        <Label>권역코드</Label>
        <Input name="regionCode" defaultValue={target?.regionCode || ''} />
      </div>
      <div className="space-y-2">
        <Label>권역명</Label>
        <Input name="regionName" defaultValue={target?.regionName || ''} />
      </div>
      <div className="space-y-2">
        <Label>최소중량 (kg)</Label>
        <Input name="weightMin" type="number" step="0.1" defaultValue={target?.weightMin ?? ''} />
      </div>
      <div className="space-y-2">
        <Label>최대중량 (kg)</Label>
        <Input name="weightMax" type="number" step="0.1" defaultValue={target?.weightMax ?? ''} />
      </div>
      <div className="space-y-2">
        <Label>
          기본요율 <span className="text-destructive">*</span>
        </Label>
        <Input name="baseRate" type="number" required aria-required="true" defaultValue={target?.baseRate ?? ''} />
      </div>
      <div className="space-y-2">
        <Label>부가요율</Label>
        <Input name="surchargeRate" type="number" defaultValue={target?.surchargeRate ?? ''} />
      </div>
      <div className="space-y-2">
        <Label>배송방법</Label>
        <Select name="shippingMethod" defaultValue={target?.shippingMethod || 'PARCEL'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SHIPPING_METHOD_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>상태</Label>
        <Select name="isActive" defaultValue={target ? (target.isActive ? 'true' : 'false') : 'true'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">활성</SelectItem>
            <SelectItem value="false">비활성</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>적용 시작일</Label>
        <Input name="effectiveFrom" type="date" defaultValue={target?.effectiveFrom || ''} />
      </div>
      <div className="space-y-2">
        <Label>적용 종료일</Label>
        <Input name="effectiveTo" type="date" defaultValue={target?.effectiveTo || ''} />
      </div>
      <div className="col-span-full space-y-2">
        <Label>메모</Label>
        <Input name="memo" defaultValue={target?.memo || ''} />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="계약/요율 관리" description="화주사별 배송 요율을 등록하고 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={shipperFilter} onValueChange={setShipperFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="전체 화주사" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 화주사</SelectItem>
            {shipperOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="전체 배송방법" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(SHIPPING_METHOD_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>요율 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>요율 등록</DialogTitle>
              <p className="text-muted-foreground text-xs">
                <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
              </p>
            </DialogHeader>
            <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
              {renderForm()}
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '요율 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={[
          ...columns,
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditTarget(row.original)}
                  aria-label="수정"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => setDeleteTarget({ id: row.original.id, name: row.original.rateName })}
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
            size: 80,
          },
        ]}
        data={rates}
        searchColumn="rateName"
        searchPlaceholder="요율명으로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
      />
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>요율 수정</DialogTitle>
            <p className="text-muted-foreground text-xs">
              <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
            </p>
          </DialogHeader>
          {editTarget && (
            <form key={editTarget.id} onSubmit={(e) => handleSubmit(e, editTarget.id)} className="space-y-4">
              {renderForm(editTarget)}
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '수정 중...' : '수정'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="요율 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}

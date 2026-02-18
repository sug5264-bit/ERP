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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const MOVEMENT_TYPE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  INBOUND: { label: '입고', variant: 'default' },
  OUTBOUND: { label: '출고', variant: 'destructive' },
  TRANSFER: { label: '이동', variant: 'secondary' },
  ADJUSTMENT: { label: '조정', variant: 'outline' },
}

interface MovementRow {
  id: string; movementNo: string; movementDate: string; movementType: string; status: string
  sourceWarehouse: { code: string; name: string } | null
  targetWarehouse: { code: string; name: string } | null
  details: { id: string; quantity: number; unitPrice: number; amount: number; item: { itemCode: string; itemName: string } }[]
}

interface MovementDetail { itemId: string; quantity: number; unitPrice: number }

const columns: ColumnDef<MovementRow>[] = [
  { accessorKey: 'movementNo', header: '이동번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.movementNo}</span> },
  { header: '이동일', cell: ({ row }) => formatDate(row.original.movementDate) },
  { header: '유형', cell: ({ row }) => { const t = MOVEMENT_TYPE_MAP[row.original.movementType]; return t ? <Badge variant={t.variant}>{t.label}</Badge> : row.original.movementType } },
  { header: '출고창고', cell: ({ row }) => row.original.sourceWarehouse?.name || '-' },
  { header: '입고창고', cell: ({ row }) => row.original.targetWarehouse?.name || '-' },
  { header: '품목수', cell: ({ row }) => `${row.original.details.length}건` },
  { header: '합계금액', cell: ({ row }) => formatCurrency(row.original.details.reduce((s, d) => s + Number(d.amount), 0)) },
]

export default function StockMovementPage() {
  const [open, setOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [movementType, setMovementType] = useState('INBOUND')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [details, setDetails] = useState<MovementDetail[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])
  const queryClient = useQueryClient()

  const qp = new URLSearchParams({ pageSize: '50' })
  if (typeFilter && typeFilter !== 'all') qp.set('movementType', typeFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-stock-movement', typeFilter],
    queryFn: () => api.get(`/inventory/stock-movement?${qp.toString()}`) as Promise<any>,
  })

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items-all'],
    queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any>,
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses'],
    queryFn: () => api.get('/inventory/warehouses') as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/inventory/stock-movement', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock-movement'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
      setOpen(false)
      setDetails([{ itemId: '', quantity: 1, unitPrice: 0 }])
      toast.success('입출고가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/stock-movement/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock-movement'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
      toast.success('입출고 내역이 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, no: string) => {
    setDeleteTarget({ id, name: no })
  }

  const movements: MovementRow[] = data?.data || []
  const allItems = itemsData?.data || []
  const warehouses = warehousesData?.data || []

  const updateDetail = (idx: number, field: string, value: any) => {
    const newDetails = [...details]
    ;(newDetails[idx] as any)[field] = value
    setDetails(newDetails)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      movementDate: form.get('movementDate'),
      movementType,
      sourceWarehouseId: form.get('sourceWarehouseId') || undefined,
      targetWarehouseId: form.get('targetWarehouseId') || undefined,
      details: details.filter((d) => d.itemId),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="입출고" description="재고의 입고/출고/이동/조정 내역을 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="전체 유형" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(MOVEMENT_TYPE_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>입출고 등록</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>입출고 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>이동일자 *</Label><Input name="movementDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>유형 *</Label>
                  <Select value={movementType} onValueChange={setMovementType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MOVEMENT_TYPE_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(movementType === 'OUTBOUND' || movementType === 'TRANSFER') && (
                  <div className="space-y-2">
                    <Label>출고창고 *</Label>
                    <Select name="sourceWarehouseId">
                      <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(movementType === 'INBOUND' || movementType === 'TRANSFER' || movementType === 'ADJUSTMENT') && (
                  <div className="space-y-2">
                    <Label>입고창고 *</Label>
                    <Select name="targetWarehouseId">
                      <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>품목</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDetails([...details, { itemId: '', quantity: 1, unitPrice: 0 }])}>
                    <Plus className="mr-1 h-3 w-3" /> 행 추가
                  </Button>
                </div>
                <div className="space-y-3">
                  {details.map((d, idx) => (
                    <div key={idx} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">품목 #{idx + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => details.length > 1 && setDetails(details.filter((_, i) => i !== idx))} disabled={details.length <= 1}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Select value={d.itemId} onValueChange={(v) => updateDetail(idx, 'itemId', v)}>
                        <SelectTrigger><SelectValue placeholder="품목 선택" /></SelectTrigger>
                        <SelectContent>
                          {allItems.map((item: any) => (
                            <SelectItem key={item.id} value={item.id}>{item.itemCode} - {item.itemName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">수량</Label>
                          <Input type="number" value={d.quantity || ''} onChange={(e) => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">단가</Label>
                          <Input type="number" value={d.unitPrice || ''} onChange={(e) => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">금액</Label>
                          <div className="h-9 flex items-center justify-end px-3 rounded-md border bg-muted/50 font-mono text-sm">{formatCurrency(d.quantity * d.unitPrice)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '입출고 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={[...columns, { id: 'delete', header: '', cell: ({ row }: any) => <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(row.original.id, row.original.movementNo)}><Trash2 className="h-4 w-4" /></Button>, size: 50 }]} data={movements} searchColumn="movementNo" searchPlaceholder="이동번호로 검색..." isLoading={isLoading} pageSize={50} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="입출고 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}

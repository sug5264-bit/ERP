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
import { formatDate, formatCurrency } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'

const STATUS_MAP: Record<string, string> = { RECEIVED: '입고', INSPECTED: '검수완료', REJECTED: '반품' }

interface Detail { itemId: string; orderedQty: number; receivedQty: number; acceptedQty: number; rejectedQty: number; unitPrice: number }

const columns: ColumnDef<any>[] = [
  { accessorKey: 'receivingNo', header: '입고번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.receivingNo}</span> },
  { header: '입고일', cell: ({ row }) => formatDate(row.original.receivingDate) },
  { header: '발주번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.purchaseOrder?.orderNo || '-'}</span> },
  { header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
  { header: '품목수', cell: ({ row }) => `${row.original.details?.length || 0}건` },
  { header: '합계', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.details?.reduce((s: number, d: any) => s + Number(d.amount), 0) || 0)}</span> },
  { header: '상태', cell: ({ row }) => <Badge variant="outline">{STATUS_MAP[row.original.status] || row.original.status}</Badge> },
]

export default function ReceivingPage() {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', orderedQty: 0, receivedQty: 0, acceptedQty: 0, rejectedQty: 0, unitPrice: 0 }])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['procurement-receiving'], queryFn: () => api.get('/procurement/receiving?pageSize=50') as Promise<any> })
  const { data: posData } = useQuery({ queryKey: ['procurement-orders-active'], queryFn: () => api.get('/procurement/orders?status=ORDERED&pageSize=200') as Promise<any> })
  const { data: itemsData } = useQuery({ queryKey: ['items-all'], queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/procurement/receiving', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['procurement-receiving'] }); setOpen(false); toast.success('입고가 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const purchaseOrders = posData?.data || []
  const items = itemsData?.data || []

  const updateDetail = (idx: number, field: string, value: any) => { const d = [...details]; (d[idx] as any)[field] = value; setDetails(d) }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      receivingDate: form.get('receivingDate'), purchaseOrderId: form.get('purchaseOrderId'),
      details: details.filter(d => d.itemId),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="입고관리" description="발주 품목의 입고 처리를 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>입고 등록</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>입고 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>입고일 *</Label><Input name="receivingDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>발주 *</Label>
                  <Select name="purchaseOrderId"><SelectTrigger><SelectValue placeholder="발주 선택" /></SelectTrigger>
                    <SelectContent>{purchaseOrders.map((po: any) => <SelectItem key={po.id} value={po.id}>{po.orderNo} - {po.partner?.partnerName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>품목</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDetails([...details, { itemId: '', orderedQty: 0, receivedQty: 0, acceptedQty: 0, rejectedQty: 0, unitPrice: 0 }])}><Plus className="mr-1 h-3 w-3" /> 행 추가</Button>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="p-2 text-left">품목</th><th className="p-2 w-20">발주수량</th><th className="p-2 w-20">입고수량</th><th className="p-2 w-20">합격수량</th><th className="p-2 w-20">불량수량</th><th className="p-2 w-28">단가</th><th className="p-2 w-10"></th></tr></thead>
                    <tbody>{details.map((d, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-1"><Select value={d.itemId} onValueChange={v => updateDetail(idx, 'itemId', v)}><SelectTrigger><SelectValue placeholder="품목 선택" /></SelectTrigger><SelectContent>{items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.itemCode} - {it.itemName}</SelectItem>)}</SelectContent></Select></td>
                        <td className="p-1"><Input type="number" value={d.orderedQty || ''} onChange={e => updateDetail(idx, 'orderedQty', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Input type="number" value={d.receivedQty || ''} onChange={e => { const v = parseFloat(e.target.value) || 0; updateDetail(idx, 'receivedQty', v); updateDetail(idx, 'acceptedQty', v) }} /></td>
                        <td className="p-1"><Input type="number" value={d.acceptedQty || ''} onChange={e => updateDetail(idx, 'acceptedQty', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Input type="number" value={d.rejectedQty || ''} onChange={e => updateDetail(idx, 'rejectedQty', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Input type="number" value={d.unitPrice || ''} onChange={e => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => details.length > 1 && setDetails(details.filter((_, i) => i !== idx))} disabled={details.length <= 1}><Trash2 className="h-3 w-3" /></Button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '등록 중...' : '입고 등록'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={data?.data || []} searchColumn="receivingNo" searchPlaceholder="입고번호로 검색..." isLoading={isLoading} pageSize={50} />
    </div>
  )
}

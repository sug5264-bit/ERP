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
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'

const STATUS_MAP: Record<string, string> = { ORDERED: '발주', IN_PROGRESS: '진행중', COMPLETED: '완료', CANCELLED: '취소' }

interface Detail { itemId: string; quantity: number; unitPrice: number }

const columns: ColumnDef<any>[] = [
  { accessorKey: 'orderNo', header: '발주번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span> },
  { id: 'orderDate', header: '발주일', cell: ({ row }) => formatDate(row.original.orderDate) },
  { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
  { id: 'deliveryDate', header: '납기일', cell: ({ row }) => row.original.deliveryDate ? formatDate(row.original.deliveryDate) : '-' },
  { id: 'totalAmount', header: '합계', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span> },
  { id: 'status', header: '상태', cell: ({ row }) => <Badge variant="outline">{STATUS_MAP[row.original.status] || row.original.status}</Badge> },
]

export default function PurchaseOrdersPage() {
  const [open, setOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])
  const queryClient = useQueryClient()

  const qp = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading } = useQuery({ queryKey: ['procurement-orders', statusFilter], queryFn: () => api.get(`/procurement/orders?${qp}`) as Promise<any> })
  const { data: partnersData } = useQuery({ queryKey: ['partners-purchase'], queryFn: () => api.get('/partners?pageSize=500') as Promise<any> })
  const { data: itemsData } = useQuery({ queryKey: ['items-all'], queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/procurement/orders', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['procurement-orders'] }); setOpen(false); setDetails([{ itemId: '', quantity: 1, unitPrice: 0 }]); toast.success('발주가 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const partners = partnersData?.data || []
  const items = itemsData?.data || []
  const purchaseOrders = data?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '발주번호', accessor: 'orderNo' },
    { header: '발주일', accessor: (r) => r.orderDate ? formatDate(r.orderDate) : '' },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '납기일', accessor: (r) => r.deliveryDate ? formatDate(r.deliveryDate) : '' },
    { header: '합계', accessor: (r) => r.totalAmount ? formatCurrency(r.totalAmount) : '' },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status] || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '발주목록', title: '발주관리 목록', columns: exportColumns, data: purchaseOrders }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const updateDetail = (idx: number, field: string, value: any) => { const d = [...details]; (d[idx] as any)[field] = value; setDetails(d) }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      orderDate: form.get('orderDate'), partnerId: form.get('partnerId'),
      deliveryDate: form.get('deliveryDate') || undefined, description: form.get('description') || undefined,
      details: details.filter(d => d.itemId),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="발주관리" description="공급업체 발주를 등록하고 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>발주 등록</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>발주 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>발주일 *</Label><Input name="orderDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>거래처 *</Label>
                  <Select name="partnerId"><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>납기일</Label><Input name="deliveryDate" type="date" /></div>
              </div>
              <div className="space-y-2"><Label>비고</Label><Input name="description" /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>품목</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDetails([...details, { itemId: '', quantity: 1, unitPrice: 0 }])}><Plus className="mr-1 h-3 w-3" /> 행 추가</Button>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="p-2 text-left">품목</th><th className="p-2 w-24">수량</th><th className="p-2 w-32">단가</th><th className="p-2 w-32">공급가</th><th className="p-2 w-32">합계</th><th className="p-2 w-10"></th></tr></thead>
                    <tbody>{details.map((d, idx) => {
                      const supply = d.quantity * d.unitPrice
                      return (<tr key={idx} className="border-b">
                        <td className="p-1"><Select value={d.itemId} onValueChange={v => updateDetail(idx, 'itemId', v)}><SelectTrigger><SelectValue placeholder="품목 선택" /></SelectTrigger><SelectContent>{items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.itemCode} - {it.itemName}</SelectItem>)}</SelectContent></Select></td>
                        <td className="p-1"><Input type="number" value={d.quantity || ''} onChange={e => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Input type="number" value={d.unitPrice || ''} onChange={e => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1 text-right font-mono">{formatCurrency(supply)}</td>
                        <td className="p-1 text-right font-mono font-medium">{formatCurrency(supply + Math.round(supply * 0.1))}</td>
                        <td className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => details.length > 1 && setDetails(details.filter((_, i) => i !== idx))} disabled={details.length <= 1}><Trash2 className="h-3 w-3" /></Button></td>
                      </tr>)
                    })}</tbody>
                  </table>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '등록 중...' : '발주 등록'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={purchaseOrders} searchColumn="orderNo" searchPlaceholder="발주번호로 검색..." isLoading={isLoading} pageSize={50} onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} />
    </div>
  )
}

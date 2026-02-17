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
import { generateTaxInvoicePDF, type TaxInvoicePDFData } from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Trash2, MoreHorizontal, CheckCircle, XCircle, FileDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ORDERED: { label: '발주', variant: 'default' }, IN_PROGRESS: { label: '진행중', variant: 'secondary' },
  COMPLETED: { label: '완료', variant: 'outline' }, CANCELLED: { label: '취소', variant: 'destructive' },
}

const CHANNEL_MAP: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
  ONLINE: { label: '온라인', variant: 'default' },
  OFFLINE: { label: '오프라인', variant: 'secondary' },
}

interface Detail { itemId: string; quantity: number; unitPrice: number }

export default function OrdersPage() {
  const [open, setOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])
  const queryClient = useQueryClient()

  const handleTaxInvoicePDF = (order: any) => {
    const orderDate = new Date(order.orderDate)
    const pdfData: TaxInvoicePDFData = {
      invoiceNo: order.orderNo,
      invoiceDate: formatDate(order.orderDate),
      supplier: { name: COMPANY_NAME, bizNo: '', ceo: '', address: '' },
      buyer: { name: order.partner?.partnerName || '', bizNo: order.partner?.bizNo || '', ceo: order.partner?.ceoName || '', address: order.partner?.address || '' },
      items: (order.details || []).map((d: any) => ({
        month: String(orderDate.getMonth() + 1), day: String(orderDate.getDate()),
        itemName: d.item?.itemName || '', spec: d.item?.spec || '',
        qty: Number(d.quantity), unitPrice: Number(d.unitPrice),
        supplyAmount: Number(d.supplyAmount), taxAmount: Number(d.taxAmount),
      })),
      totalSupply: Number(order.totalSupply), totalTax: Number(order.totalTax), totalAmount: Number(order.totalAmount),
    }
    generateTaxInvoicePDF(pdfData)
    toast.success('세금계산서 PDF가 다운로드되었습니다.')
  }

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.put(`/sales/orders/${id}`, { action: 'complete' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); toast.success('발주가 완료 처리되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/sales/orders/${id}`, { action: 'cancel' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); toast.success('발주가 취소 처리되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/orders/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); toast.success('발주가 삭제되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, no: string) => {
    if (window.confirm(`발주 [${no}]를 삭제하시겠습니까?`)) deleteMutation.mutate(id)
  }

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'orderNo', header: '발주번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span> },
    { id: 'orderDate', header: '발주일', cell: ({ row }) => formatDate(row.original.orderDate) },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    { id: 'deliveryDate', header: '납기일', cell: ({ row }) => row.original.deliveryDate ? formatDate(row.original.deliveryDate) : '-' },
    { id: 'salesChannel', header: '채널', cell: ({ row }) => { const c = CHANNEL_MAP[row.original.salesChannel]; return c ? <Badge variant={c.variant}>{c.label}</Badge> : row.original.salesChannel || '오프라인' } },
    { id: 'totalAmount', header: '합계', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span> },
    { id: 'status', header: '상태', cell: ({ row }) => { const s = STATUS_MAP[row.original.status]; return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status } },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const status = row.original.status
        const canComplete = status === 'ORDERED' || status === 'IN_PROGRESS'
        const canCancel = status !== 'CANCELLED' && status !== 'COMPLETED'
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleTaxInvoicePDF(row.original)}>
                <FileDown className="mr-2 h-4 w-4" />
                세금계산서 PDF
              </DropdownMenuItem>
              {canComplete && (
                <DropdownMenuItem onClick={() => completeMutation.mutate(row.original.id)} disabled={completeMutation.isPending}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  완료 처리
                </DropdownMenuItem>
              )}
              {canCancel && (
                <DropdownMenuItem onClick={() => cancelMutation.mutate(row.original.id)} disabled={cancelMutation.isPending}>
                  <XCircle className="mr-2 h-4 w-4" />
                  취소 처리
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(row.original.id, row.original.orderNo)} disabled={deleteMutation.isPending}>
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const qp = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)
  if (channelFilter && channelFilter !== 'all') qp.set('salesChannel', channelFilter)

  const { data, isLoading } = useQuery({ queryKey: ['sales-orders', statusFilter, channelFilter], queryFn: () => api.get(`/sales/orders?${qp}`) as Promise<any> })
  const { data: partnersData } = useQuery({ queryKey: ['partners-sales'], queryFn: () => api.get('/partners?pageSize=500') as Promise<any> })
  const { data: itemsData } = useQuery({ queryKey: ['items-all'], queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/orders', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); setOpen(false); setDetails([{ itemId: '', quantity: 1, unitPrice: 0 }]); toast.success('발주가 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const partners = partnersData?.data || []
  const items = itemsData?.data || []
  const orders = data?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '발주번호', accessor: 'orderNo' },
    { header: '발주일', accessor: (r) => r.orderDate ? formatDate(r.orderDate) : '' },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '납기일', accessor: (r) => r.deliveryDate ? formatDate(r.deliveryDate) : '' },
    { header: '채널', accessor: (r) => CHANNEL_MAP[r.salesChannel]?.label || '오프라인' },
    { header: '합계', accessor: (r) => r.totalAmount ? formatCurrency(r.totalAmount) : '' },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '발주목록', title: '발주관리 목록', columns: exportColumns, data: orders }
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
      salesChannel: form.get('salesChannel') || 'OFFLINE',
      deliveryDate: form.get('deliveryDate') || undefined, description: form.get('description') || undefined,
      details: details.filter(d => d.itemId),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="발주관리" description="발주를 등록하고 관리합니다" />
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 채널" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="ONLINE">온라인</SelectItem>
            <SelectItem value="OFFLINE">오프라인</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>발주 등록</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>발주 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2"><Label>발주일 *</Label><Input name="orderDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>거래처 *</Label>
                  <Select name="partnerId"><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>판매채널 *</Label>
                  <Select name="salesChannel" defaultValue="OFFLINE"><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONLINE">온라인</SelectItem>
                      <SelectItem value="OFFLINE">오프라인</SelectItem>
                    </SelectContent>
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
      <DataTable columns={columns} data={orders} searchColumn="orderNo" searchPlaceholder="발주번호로 검색..." isLoading={isLoading} pageSize={50} onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} />
    </div>
  )
}

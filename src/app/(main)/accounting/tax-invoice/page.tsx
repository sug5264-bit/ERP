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

interface TaxInvoiceRow {
  id: string; invoiceNo: string; issueDate: string; invoiceType: string
  supplierName: string; supplierBizNo: string; buyerName: string; buyerBizNo: string
  supplyAmount: number; taxAmount: number; totalAmount: number
  transmissionStatus: string
  partner: { partnerName: string } | null
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: '미전송', variant: 'outline' },
  SENT: { label: '전송', variant: 'default' },
  CONFIRMED: { label: '확인', variant: 'default' },
  ERROR: { label: '오류', variant: 'destructive' },
}

const columns: ColumnDef<TaxInvoiceRow>[] = [
  { accessorKey: 'invoiceNo', header: '계산서번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.invoiceNo}</span> },
  { header: '발행일', cell: ({ row }) => formatDate(row.original.issueDate) },
  { header: '구분', cell: ({ row }) => <Badge variant={row.original.invoiceType === 'SALES' ? 'default' : 'secondary'}>{row.original.invoiceType === 'SALES' ? '매출' : '매입'}</Badge> },
  { header: '공급자', cell: ({ row }) => row.original.supplierName },
  { header: '공급받는자', cell: ({ row }) => row.original.buyerName },
  { header: '공급가액', cell: ({ row }) => formatCurrency(row.original.supplyAmount) },
  { header: '세액', cell: ({ row }) => formatCurrency(row.original.taxAmount) },
  { header: '합계', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span> },
  { header: '전송상태', cell: ({ row }) => { const s = STATUS_MAP[row.original.transmissionStatus]; return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.transmissionStatus } },
]

interface InvoiceItem { itemDate: string; itemName: string; specification: string; qty: number; unitPrice: number; supplyAmount: number; taxAmount: number }

export default function TaxInvoicePage() {
  const [open, setOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([{ itemDate: '', itemName: '', specification: '', qty: 1, unitPrice: 0, supplyAmount: 0, taxAmount: 0 }])
  const queryClient = useQueryClient()

  const qp = new URLSearchParams({ pageSize: '50' })
  if (typeFilter && typeFilter !== 'all') qp.set('invoiceType', typeFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-tax-invoice', typeFilter],
    queryFn: () => api.get(`/accounting/tax-invoice?${qp.toString()}`) as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/accounting/tax-invoice', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-tax-invoice'] })
      setOpen(false)
      setItems([{ itemDate: '', itemName: '', specification: '', qty: 1, unitPrice: 0, supplyAmount: 0, taxAmount: 0 }])
      toast.success('세금계산서가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const invoices: TaxInvoiceRow[] = data?.data || []

  const updateItem = (idx: number, field: string, value: any) => {
    const newItems = [...items]
    ;(newItems[idx] as any)[field] = value
    if (field === 'qty' || field === 'unitPrice') {
      const qty = field === 'qty' ? value : newItems[idx].qty
      const price = field === 'unitPrice' ? value : newItems[idx].unitPrice
      newItems[idx].supplyAmount = qty * price
      newItems[idx].taxAmount = Math.round(qty * price * 0.1)
    }
    setItems(newItems)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      issueDate: form.get('issueDate'),
      invoiceType: form.get('invoiceType'),
      supplierBizNo: form.get('supplierBizNo'),
      supplierName: form.get('supplierName'),
      supplierCeo: form.get('supplierCeo') || undefined,
      buyerBizNo: form.get('buyerBizNo'),
      buyerName: form.get('buyerName'),
      buyerCeo: form.get('buyerCeo') || undefined,
      items: items.filter((i) => i.itemName),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="세금계산서" description="세금계산서를 발행하고 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 구분" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="SALES">매출</SelectItem>
            <SelectItem value="PURCHASE">매입</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>계산서 발행</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>세금계산서 발행</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>발행일 *</Label><Input name="issueDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>구분 *</Label>
                  <Select name="invoiceType" required>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent><SelectItem value="SALES">매출</SelectItem><SelectItem value="PURCHASE">매입</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3 rounded border p-3">
                  <h4 className="text-sm font-medium">공급자</h4>
                  <div className="space-y-2"><Label>사업자번호 *</Label><Input name="supplierBizNo" required placeholder="000-00-00000" /></div>
                  <div className="space-y-2"><Label>상호 *</Label><Input name="supplierName" required /></div>
                  <div className="space-y-2"><Label>대표자</Label><Input name="supplierCeo" /></div>
                </div>
                <div className="space-y-3 rounded border p-3">
                  <h4 className="text-sm font-medium">공급받는자</h4>
                  <div className="space-y-2"><Label>사업자번호 *</Label><Input name="buyerBizNo" required placeholder="000-00-00000" /></div>
                  <div className="space-y-2"><Label>상호 *</Label><Input name="buyerName" required /></div>
                  <div className="space-y-2"><Label>대표자</Label><Input name="buyerCeo" /></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>품목</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { itemDate: '', itemName: '', specification: '', qty: 1, unitPrice: 0, supplyAmount: 0, taxAmount: 0 }])}>
                    <Plus className="mr-1 h-3 w-3" /> 행 추가
                  </Button>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="p-2">일자</th><th className="p-2">품목</th><th className="p-2 w-20">수량</th><th className="p-2 w-28">단가</th><th className="p-2 w-28">공급가액</th><th className="p-2 w-24">세액</th><th className="p-2 w-10"></th></tr></thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-1"><Input type="date" value={item.itemDate} onChange={(e) => updateItem(idx, 'itemDate', e.target.value)} /></td>
                          <td className="p-1"><Input value={item.itemName} onChange={(e) => updateItem(idx, 'itemName', e.target.value)} /></td>
                          <td className="p-1"><Input type="number" value={item.qty || ''} onChange={(e) => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)} /></td>
                          <td className="p-1"><Input type="number" value={item.unitPrice || ''} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} /></td>
                          <td className="p-1 text-right font-mono">{formatCurrency(item.supplyAmount)}</td>
                          <td className="p-1 text-right font-mono">{formatCurrency(item.taxAmount)}</td>
                          <td className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))} disabled={items.length <= 1}><Trash2 className="h-3 w-3" /></Button></td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-medium">
                        <td className="p-2" colSpan={4}>합계</td>
                        <td className="p-2 text-right">{formatCurrency(items.reduce((s, i) => s + i.supplyAmount, 0))}</td>
                        <td className="p-2 text-right">{formatCurrency(items.reduce((s, i) => s + i.taxAmount, 0))}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '발행 중...' : '세금계산서 발행'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={invoices} searchColumn="invoiceNo" searchPlaceholder="계산서번호로 검색..." isLoading={isLoading} pageSize={50} />
    </div>
  )
}

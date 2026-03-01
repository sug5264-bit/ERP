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

interface TaxInvoiceRow {
  id: string
  invoiceNo: string
  issueDate: string
  invoiceType: string
  supplierName: string
  supplierBizNo: string
  buyerName: string
  buyerBizNo: string
  supplyAmount: number
  taxAmount: number
  totalAmount: number
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
  {
    accessorKey: 'invoiceNo',
    header: '계산서번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.invoiceNo}</span>,
  },
  { header: '발행일', cell: ({ row }) => formatDate(row.original.issueDate) },
  {
    header: '구분',
    cell: ({ row }) => (
      <Badge variant={row.original.invoiceType === 'SALES' ? 'default' : 'secondary'}>
        {row.original.invoiceType === 'SALES' ? '매출' : '매입'}
      </Badge>
    ),
  },
  { header: '공급자', cell: ({ row }) => row.original.supplierName },
  { header: '공급받는자', cell: ({ row }) => row.original.buyerName },
  { header: '공급가액', cell: ({ row }) => formatCurrency(row.original.supplyAmount) },
  { header: '세액', cell: ({ row }) => formatCurrency(row.original.taxAmount) },
  {
    header: '합계',
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span>,
  },
  {
    header: '전송상태',
    cell: ({ row }) => {
      const s = STATUS_MAP[row.original.transmissionStatus]
      return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.transmissionStatus
    },
  },
]

interface InvoiceItem {
  itemDate: string
  itemName: string
  specification: string
  qty: number
  unitPrice: number
  supplyAmount: number
  taxAmount: number
}

export default function TaxInvoicePage() {
  const [open, setOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([
    { itemDate: '', itemName: '', specification: '', qty: 1, unitPrice: 0, supplyAmount: 0, taxAmount: 0 },
  ])
  const queryClient = useQueryClient()

  const qp = new URLSearchParams({ pageSize: '50' })
  if (typeFilter && typeFilter !== 'all') qp.set('invoiceType', typeFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-tax-invoice', typeFilter],
    queryFn: () => api.get(`/accounting/tax-invoice?${qp.toString()}`),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/accounting/tax-invoice', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-tax-invoice'] })
      setOpen(false)
      setItems([{ itemDate: '', itemName: '', specification: '', qty: 1, unitPrice: 0, supplyAmount: 0, taxAmount: 0 }])
      toast.success('세금계산서가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const invoices: TaxInvoiceRow[] = data?.data || []

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items]
    ;(newItems[idx] as unknown as Record<string, string | number>)[field] = value
    if (field === 'qty' || field === 'unitPrice') {
      const qty = field === 'qty' ? value : newItems[idx].qty
      const price = field === 'unitPrice' ? value : newItems[idx].unitPrice
      newItems[idx].supplyAmount = Number(qty) * Number(price)
      newItems[idx].taxAmount = Math.round(Number(qty) * Number(price) * 0.1)
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
          <SelectTrigger className="w-36">
            <SelectValue placeholder="전체 구분" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="SALES">매출</SelectItem>
            <SelectItem value="PURCHASE">매입</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>계산서 발행</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl lg:max-w-4xl">
            <DialogHeader>
              <DialogTitle>세금계산서 발행</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>
                    발행일 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="issueDate" type="date" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>
                    구분 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="invoiceType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SALES">매출</SelectItem>
                      <SelectItem value="PURCHASE">매입</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded border p-3">
                  <h4 className="text-sm font-medium">공급자</h4>
                  <div className="space-y-2">
                    <Label>
                      사업자번호 <span className="text-destructive">*</span>
                    </Label>
                    <Input name="supplierBizNo" required aria-required="true" placeholder="000-00-00000" />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      상호 <span className="text-destructive">*</span>
                    </Label>
                    <Input name="supplierName" required aria-required="true" />
                  </div>
                  <div className="space-y-2">
                    <Label>대표자</Label>
                    <Input name="supplierCeo" />
                  </div>
                </div>
                <div className="space-y-3 rounded border p-3">
                  <h4 className="text-sm font-medium">공급받는자</h4>
                  <div className="space-y-2">
                    <Label>
                      사업자번호 <span className="text-destructive">*</span>
                    </Label>
                    <Input name="buyerBizNo" required aria-required="true" placeholder="000-00-00000" />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      상호 <span className="text-destructive">*</span>
                    </Label>
                    <Input name="buyerName" required aria-required="true" />
                  </div>
                  <div className="space-y-2">
                    <Label>대표자</Label>
                    <Input name="buyerCeo" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>품목</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setItems([
                        ...items,
                        {
                          itemDate: '',
                          itemName: '',
                          specification: '',
                          qty: 1,
                          unitPrice: 0,
                          supplyAmount: 0,
                          taxAmount: 0,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" /> 행 추가
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs font-medium">품목 #{idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))}
                          disabled={items.length <= 1}
                          aria-label="삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">일자</Label>
                          <Input
                            type="date"
                            className="text-xs"
                            value={item.itemDate}
                            onChange={(e) => updateItem(idx, 'itemDate', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">품목명</Label>
                          <Input
                            className="text-xs"
                            value={item.itemName}
                            onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-xs">수량</Label>
                          <Input
                            type="number"
                            className="text-xs"
                            value={item.qty || ''}
                            onChange={(e) => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">단가</Label>
                          <Input
                            type="number"
                            className="text-xs"
                            value={item.unitPrice || ''}
                            onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">공급가액</Label>
                          <div className="bg-muted/50 flex h-9 items-center justify-end rounded-md border px-2 font-mono text-xs">
                            {formatCurrency(item.supplyAmount)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">세액</Label>
                          <div className="bg-muted/50 flex h-9 items-center justify-end rounded-md border px-2 font-mono text-xs">
                            {formatCurrency(item.taxAmount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/50 flex items-center justify-between rounded-md border p-3 text-sm font-medium">
                  <span>합계</span>
                  <div className="flex items-center gap-4">
                    <span>공급가: {formatCurrency(items.reduce((s, i) => s + i.supplyAmount, 0))}</span>
                    <span>세액: {formatCurrency(items.reduce((s, i) => s + i.taxAmount, 0))}</span>
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '발행 중...' : '세금계산서 발행'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={columns}
        data={invoices}
        searchColumn="invoiceNo"
        searchPlaceholder="계산서번호로 검색..."
        isLoading={isLoading}
        pageSize={50}
      />
    </div>
  )
}

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
import { generateQuotationPDF, type QuotationPDFData } from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Trash2, FileDown, ArrowRightLeft } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: '임시', variant: 'outline' },
  SUBMITTED: { label: '제출', variant: 'default' },
  ORDERED: { label: '발주전환', variant: 'secondary' },
  LOST: { label: '실주', variant: 'destructive' },
  CANCELLED: { label: '취소', variant: 'destructive' },
}

interface QuotationRow {
  id: string
  quotationNo: string
  quotationDate: string
  validUntil?: string | null
  status: string
  totalSupply: number
  totalTax: number
  totalAmount: number
  description?: string | null
  partner?: { id: string; partnerCode: string; partnerName: string } | null
  employee?: { id: string; nameKo: string } | null
  details?: QuotationDetailRow[]
}

interface QuotationDetailRow {
  id: string
  itemId: string
  quantity: number
  unitPrice: number
  supplyAmount: number
  taxAmount: number
  totalAmount: number
  item?: {
    id: string
    itemName: string
    itemCode?: string
    specification?: string
    storageTemp?: string
    manufacturer?: string
  }
}

interface PartnerOption {
  id: string
  partnerName: string
  partnerCode: string
  haccpNo?: string | null
}

interface ItemOption {
  id: string
  itemCode: string
  itemName: string
  taxType?: string
  storageTemp?: string | null
  manufacturer?: string | null
}

interface Detail {
  itemId: string
  quantity: number
  unitPrice: number
}

export default function QuotationsPage() {
  const [open, setOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [convertTarget, setConvertTarget] = useState<{ id: string; quotationNo: string } | null>(null)
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])
  const queryClient = useQueryClient()

  const handlePDF = (q: QuotationRow) => {
    const pdfData: QuotationPDFData = {
      quotationNo: q.quotationNo,
      quotationDate: formatDate(q.quotationDate),
      validUntil: q.validUntil ? formatDate(q.validUntil) : undefined,
      company: { name: COMPANY_NAME },
      partner: { name: q.partner?.partnerName || '' },
      items: (q.details || []).map((d: QuotationDetailRow, i: number) => ({
        no: i + 1,
        itemName: d.item?.itemName || '',
        spec: d.item?.specification || '',
        qty: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
        supplyAmount: Number(d.supplyAmount),
        taxAmount: Number(d.taxAmount),
        totalAmount: Number(d.totalAmount),
      })),
      totalSupply: Number(q.totalSupply),
      totalTax: Number(q.totalTax),
      totalAmount: Number(q.totalAmount),
      description: q.description || undefined,
    }
    generateQuotationPDF(pdfData)
    toast.success('견적서 PDF가 다운로드되었습니다.')
  }

  const columns: ColumnDef<QuotationRow>[] = [
    {
      accessorKey: 'quotationNo',
      header: '견적번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.quotationNo}</span>,
    },
    { id: 'quotationDate', header: '견적일', cell: ({ row }) => formatDate(row.original.quotationDate) },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    { id: 'employee', header: '담당자', cell: ({ row }) => row.original.employee?.nameKo || '-' },
    { id: 'totalSupply', header: '공급가액', cell: ({ row }) => formatCurrency(row.original.totalSupply) },
    { id: 'totalTax', header: '세액', cell: ({ row }) => formatCurrency(row.original.totalTax) },
    {
      id: 'totalAmount',
      header: '합계',
      cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span>,
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => {
        const s = STATUS_MAP[row.original.status]
        return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status
      },
    },
    {
      id: 'pdf',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handlePDF(row.original)}
          title="견적서 PDF"
          aria-label="견적서 PDF 다운로드"
        >
          <FileDown className="h-4 w-4" />
        </Button>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const q = row.original
        const canConvert = q.status === 'DRAFT' || q.status === 'SUBMITTED'
        return (
          <div className="flex gap-1">
            {canConvert && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setConvertTarget({ id: q.id, quotationNo: q.quotationNo })}
                title="수주 전환"
                aria-label="수주 전환"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-8 w-8"
              onClick={() => handleDelete(q.id, q.quotationNo)}
              aria-label="삭제"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
      size: 100,
    },
  ]

  const qp = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-quotations', statusFilter],
    queryFn: () => api.get(`/sales/quotations?${qp}`) as Promise<{ data: QuotationRow[] }>,
  })
  const { data: partnersData } = useQuery({
    queryKey: ['partners-sales'],
    queryFn: () => api.get('/partners?pageSize=500') as Promise<{ data: PartnerOption[] }>,
    staleTime: 10 * 60 * 1000,
  })
  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<{ data: ItemOption[] }>,
    staleTime: 10 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/quotations', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotations'] })
      setOpen(false)
      setDetails([{ itemId: '', quantity: 1, unitPrice: 0 }])
      toast.success('견적이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/quotations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotations'] })
      toast.success('견적이 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.put(`/sales/quotations/${id}`, { action: 'convert' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotations'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('수주로 전환되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, no: string) => {
    setDeleteTarget({ id, name: no })
  }

  const partners: PartnerOption[] = partnersData?.data || []
  const items: ItemOption[] = itemsData?.data || []
  const quotations: QuotationRow[] = data?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '견적번호', accessor: 'quotationNo' },
    { header: '견적일', accessor: (r) => (r.quotationDate ? formatDate(r.quotationDate) : '') },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '담당자', accessor: (r) => r.employee?.nameKo || '' },
    { header: '공급가액', accessor: (r) => formatCurrency(r.totalSupply) },
    { header: '세액', accessor: (r) => formatCurrency(r.totalTax) },
    { header: '합계', accessor: (r) => formatCurrency(r.totalAmount) },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '견적목록', title: '견적관리 목록', columns: exportColumns, data: quotations }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const updateDetail = (idx: number, field: keyof Detail, value: string | number) => {
    const d = [...details]
    if (field === 'itemId') {
      d[idx] = { ...d[idx], itemId: value as string }
    } else {
      d[idx] = { ...d[idx], [field]: value as number }
    }
    setDetails(d)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      quotationDate: form.get('quotationDate'),
      partnerId: form.get('partnerId'),
      validUntil: form.get('validUntil') || undefined,
      description: form.get('description') || undefined,
      details: details.filter((d) => d.itemId),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="견적관리" description="OEM 제조 견적서를 작성하고 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>견적 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl lg:max-w-5xl">
            <DialogHeader>
              <DialogTitle>견적 등록</DialogTitle>
              <p className="text-muted-foreground text-xs">
                <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
              </p>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>
                    견적일 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="quotationDate" type="date" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>
                    거래처 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="partnerId">
                    <SelectTrigger>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((p: PartnerOption) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.partnerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>유효기간</Label>
                  <Input name="validUntil" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>비고</Label>
                <Input name="description" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>품목</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetails([...details, { itemId: '', quantity: 1, unitPrice: 0 }])}
                  >
                    <Plus className="mr-1 h-3 w-3" /> 행 추가
                  </Button>
                </div>
                <div className="space-y-3">
                  {details.map((d, idx) => {
                    const supply = d.quantity * d.unitPrice
                    const itemTaxType = items.find((it: ItemOption) => it.id === d.itemId)?.taxType || 'TAXABLE'
                    const tax = itemTaxType === 'TAXABLE' ? Math.round(supply * 0.1) : 0
                    return (
                      <div key={`detail-${idx}-${d.itemId}`} className="space-y-2 rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs font-medium">품목 #{idx + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => details.length > 1 && setDetails(details.filter((_, i) => i !== idx))}
                            disabled={details.length <= 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Select value={d.itemId} onValueChange={(v) => updateDetail(idx, 'itemId', v)}>
                          <SelectTrigger className="truncate text-xs">
                            <SelectValue placeholder="품목 선택" />
                          </SelectTrigger>
                          <SelectContent className="max-w-[calc(100vw-4rem)]">
                            {items.map((it: ItemOption) => (
                              <SelectItem key={it.id} value={it.id}>
                                <span className="truncate">
                                  {it.itemCode} - {it.itemName}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="grid min-w-0 grid-cols-5 gap-2">
                          <div className="min-w-0 space-y-1">
                            <Label className="text-[11px]">수량</Label>
                            <Input
                              type="number"
                              className="text-xs"
                              value={d.quantity || ''}
                              onChange={(e) => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-[11px]">단가</Label>
                            <Input
                              type="number"
                              className="text-xs"
                              value={d.unitPrice || ''}
                              onChange={(e) => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-[11px]">공급가</Label>
                            <div className="bg-muted/50 flex h-9 items-center justify-end rounded-md border px-2 font-mono text-xs">
                              {formatCurrency(supply)}
                            </div>
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-[11px]">세액</Label>
                            <div className="bg-muted/50 flex h-9 items-center justify-end rounded-md border px-2 font-mono text-xs">
                              {formatCurrency(tax)}
                            </div>
                          </div>
                          <div className="min-w-0 space-y-1">
                            <Label className="text-[11px]">합계</Label>
                            <div className="bg-muted/50 flex h-9 items-center justify-end rounded-md border px-2 font-mono text-xs font-medium">
                              {formatCurrency(supply + tax)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-right text-sm font-medium">
                  합계:{' '}
                  {formatCurrency(
                    details.reduce((s, d) => {
                      const sup = d.quantity * d.unitPrice
                      const tt = items.find((it: ItemOption) => it.id === d.itemId)?.taxType || 'TAXABLE'
                      return s + sup + (tt === 'TAXABLE' ? Math.round(sup * 0.1) : 0)
                    }, 0)
                  )}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '견적 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={columns}
        data={quotations}
        searchColumn="quotationNo"
        searchPlaceholder="견적번호로 검색..."
        isLoading={isLoading}
        pageSize={50}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="견적 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        isPending={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={!!convertTarget}
        onOpenChange={(open) => !open && setConvertTarget(null)}
        title="수주 전환"
        description={`[${convertTarget?.quotationNo}] 견적을 수주로 전환하시겠습니까?`}
        confirmLabel="수주 전환"
        onConfirm={() => {
          if (convertTarget) convertMutation.mutate(convertTarget.id)
        }}
        isPending={convertMutation.isPending}
      />
    </div>
  )
}

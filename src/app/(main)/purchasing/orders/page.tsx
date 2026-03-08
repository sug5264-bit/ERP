'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { SummaryCards } from '@/components/common/summary-cards'
import { PermissionGuard } from '@/components/common/permission-guard'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ClipboardList, Plus, Loader2, CheckCircle, DollarSign, FileDown, Trash2 } from 'lucide-react'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { generatePurchaseOrderPDF, type PurchaseOrderPDFData } from '@/lib/pdf-reports'

interface PartnerOption {
  id: string
  partnerName: string
}

interface ItemOption {
  id: string
  itemName: string
  specification: string | null
  unit: string | null
}

interface OrderLine {
  itemId: string
  quantity: number
  unitPrice: number
  remark: string
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  ORDERED: '발주완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '입고완료',
  CANCELLED: '취소',
}

interface PurchaseOrder {
  id: string
  orderNo: string
  orderDate: string
  supplierName: string
  supplyAmount: number
  totalAmount: number
  status: string
  managerName: string
}

const columns: ColumnDef<PurchaseOrder>[] = [
  {
    accessorKey: 'orderNo',
    header: '발주번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span>,
  },
  {
    accessorKey: 'orderDate',
    header: '발주일',
    cell: ({ row }) => formatDate(row.original.orderDate),
  },
  {
    accessorKey: 'supplierName',
    header: '매입처명',
    cell: ({ row }) => <span className="font-medium">{row.original.supplierName}</span>,
  },
  {
    accessorKey: 'supplyAmount',
    header: '공급가액',
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.supplyAmount)}</span>,
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={ORDER_STATUS_LABELS} />,
  },
  {
    accessorKey: 'managerName',
    header: '담당자',
  },
]

const emptyLine = (): OrderLine => ({ itemId: '', quantity: 1, unitPrice: 0, remark: '' })

export default function PurchasingOrdersPage() {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  // 발주 등록 상태
  const [createOpen, setCreateOpen] = useState(false)
  const [formOrderDate, setFormOrderDate] = useState(getLocalDateString())
  const [formPartnerId, setFormPartnerId] = useState('')
  const [formDeliveryDate, setFormDeliveryDate] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formVatIncluded, setFormVatIncluded] = useState(true)
  const [formLines, setFormLines] = useState<OrderLine[]>([emptyLine()])

  const qp = new URLSearchParams({ page: '1', pageSize: '50' })
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchasing-orders', startDate, endDate, statusFilter],
    queryFn: () => api.get(`/purchasing/orders?${qp.toString()}`),
  })

  const { data: partnersData } = useQuery({
    queryKey: ['purchasing-partners'],
    queryFn: () => api.get('/partners?partnerType=PURCHASE&pageSize=200'),
    enabled: createOpen,
  })
  const partners: PartnerOption[] = (partnersData?.data || []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    partnerName: String(p.partnerName),
  }))

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items-all'],
    queryFn: () => api.get('/inventory/items?pageSize=500'),
    enabled: createOpen,
  })
  const itemOptions: ItemOption[] = (itemsData?.data || []).map((i: Record<string, unknown>) => ({
    id: String(i.id),
    itemName: String(i.itemName),
    specification: i.specification as string | null,
    unit: i.unit as string | null,
  }))

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/purchasing/orders', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-orders'] })
      setCreateOpen(false)
      resetCreateForm()
      toast.success('발주서가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message || '발주 등록에 실패했습니다.'),
  })

  const resetCreateForm = () => {
    setFormOrderDate(getLocalDateString())
    setFormPartnerId('')
    setFormDeliveryDate('')
    setFormDescription('')
    setFormVatIncluded(true)
    setFormLines([emptyLine()])
  }

  const handleCreateSubmit = () => {
    if (!formOrderDate || !formPartnerId) {
      toast.error('발주일과 매입처를 입력하세요.')
      return
    }
    const validLines = formLines.filter((l) => l.itemId && l.quantity > 0 && l.unitPrice >= 0)
    if (validLines.length === 0) {
      toast.error('최소 1개 이상의 품목을 입력하세요.')
      return
    }
    createMutation.mutate({
      orderDate: formOrderDate,
      partnerId: formPartnerId,
      deliveryDate: formDeliveryDate || undefined,
      description: formDescription || undefined,
      vatIncluded: formVatIncluded,
      details: validLines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        remark: l.remark || undefined,
      })),
    })
  }

  const updateLine = (index: number, field: keyof OrderLine, value: string | number) => {
    setFormLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  const items = (data?.data || []) as PurchaseOrder[]

  const exportColumns: ExportColumn[] = [
    { header: '발주번호', accessor: 'orderNo' },
    { header: '발주일', accessor: (r) => r.orderDate },
    { header: '매입처', accessor: 'supplierName' },
    { header: '공급가액', accessor: (r) => Number(r.supplyAmount) },
    { header: '합계금액', accessor: (r) => Number(r.totalAmount) },
    { header: '상태', accessor: (r) => ORDER_STATUS_LABELS[r.status] || r.status },
    { header: '담당자', accessor: 'managerName' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '발주목록', title: '발주 관리 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const handleRowClick = async (row: PurchaseOrder) => {
    try {
      const res = (await api.get(`/purchasing/orders/${row.id}`)) as Record<string, unknown>
      setSelectedOrder((res.data || res) as Record<string, unknown>)
      setDetailOpen(true)
    } catch {
      toast.error('발주 데이터를 불러올 수 없습니다.')
    }
  }

  const handlePdfDownload = async () => {
    if (!selectedOrder) return
    setPdfLoading(true)
    try {
      const partner = selectedOrder.partner as Record<string, string> | undefined
      const details = (selectedOrder.details || []) as Record<string, unknown>[]

      // Fetch default company info
      let companyInfo: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string } = { name: '(주)웰그린' }
      try {
        const companyRes = (await api.get('/admin/company')) as { data: Record<string, string>[] }
        const defaultCompany = companyRes.data?.find((c: Record<string, unknown>) => c.isDefault) || companyRes.data?.[0]
        if (defaultCompany) {
          companyInfo = {
            name: defaultCompany.companyName || companyInfo.name,
            ceo: defaultCompany.ceoName,
            address: defaultCompany.address,
            tel: defaultCompany.phone,
            bizNo: defaultCompany.bizNo,
          }
        }
      } catch { /* use default */ }

      const pdfData: PurchaseOrderPDFData = {
        orderNo: String(selectedOrder.orderNo || ''),
        orderDate: formatDate(String(selectedOrder.orderDate || '')),
        deliveryDate: selectedOrder.deliveryDate ? formatDate(String(selectedOrder.deliveryDate)) : undefined,
        company: companyInfo,
        supplier: {
          name: partner?.partnerName || '',
          ceo: partner?.ceoName,
          address: partner?.address,
          tel: partner?.phone,
          bizNo: partner?.bizNo,
        },
        items: details.map((d, i) => {
          const item = d.item as Record<string, string> | undefined
          return {
            no: i + 1,
            itemName: item?.itemName || '',
            spec: item?.specification,
            unit: item?.unit,
            qty: Number(d.quantity),
            unitPrice: Number(d.unitPrice),
            supplyAmount: Number(d.supplyAmount),
            taxAmount: Number(d.taxAmount),
            totalAmount: Number(d.amount),
          }
        }),
        totalSupply: Number(selectedOrder.totalSupply),
        totalTax: Number(selectedOrder.totalTax),
        totalAmount: Number(selectedOrder.totalAmount),
        description: selectedOrder.description as string | undefined,
      }

      await generatePurchaseOrderPDF(pdfData)
      toast.success('발주서 PDF가 다운로드되었습니다.')
    } catch (err) {
      toast.error('PDF 생성에 실패했습니다.')
      console.error(err)
    } finally {
      setPdfLoading(false)
    }
  }

  const totalCount = items.length
  const inProgressCount = items.filter((i) => i.status === 'IN_PROGRESS').length
  const completedCount = items.filter((i) => i.status === 'COMPLETED').length
  const thisMonthAmount = items
    .filter((i) => {
      const d = new Date(i.orderDate)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, i) => sum + (i.supplyAmount || 0), 0)

  const summaryItems = [
    { label: '전체', value: totalCount, icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: '진행중', value: inProgressCount, icon: Loader2, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: '완료', value: completedCount, icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
    {
      label: '이번달 발주금액',
      value: `${formatCurrency(thisMonthAmount)}`,
      icon: DollarSign,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
  ]

  const orderDetails = (selectedOrder?.details || []) as Record<string, unknown>[]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="발주관리"
        description="원자재 및 부자재 발주를 등록하고 관리합니다"
        actions={
          <PermissionGuard module="purchasing" action="create">
            <Button size="sm" onClick={() => { resetCreateForm(); setCreateOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" /> 발주 등록
            </Button>
          </PermissionGuard>
        }
      />

      <SummaryCards items={summaryItems} isLoading={isLoading} />

      <div className="flex flex-wrap items-end gap-2">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="발주번호, 매입처 검색..."
        searchColumn="orderNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={handleRowClick}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />

      {/* 발주 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreateForm() }}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>발주서 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>발주일 <span className="text-destructive">*</span></Label>
                <Input type="date" value={formOrderDate} onChange={(e) => setFormOrderDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>매입처 <span className="text-destructive">*</span></Label>
                <Select value={formPartnerId} onValueChange={setFormPartnerId}>
                  <SelectTrigger><SelectValue placeholder="매입처 선택" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>납기일</Label>
                <Input type="date" value={formDeliveryDate} onChange={(e) => setFormDeliveryDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="vatIncluded" checked={formVatIncluded} onChange={(e) => setFormVatIncluded(e.target.checked)} className="rounded border" />
                <Label htmlFor="vatIncluded">부가세 포함</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>비고</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="비고 사항을 입력하세요" rows={2} />
            </div>

            {/* 품목 라인 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">발주 품목</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFormLines([...formLines, emptyLine()])}>
                  <Plus className="mr-1 h-3 w-3" /> 행 추가
                </Button>
              </div>
              <div className="space-y-2">
                {formLines.map((line, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
                    <div className="min-w-[140px] flex-1 space-y-1">
                      <Label className="text-xs">품목 <span className="text-destructive">*</span></Label>
                      <Select value={line.itemId} onValueChange={(v) => updateLine(idx, 'itemId', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="품목 선택" /></SelectTrigger>
                        <SelectContent>
                          {itemOptions.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.itemName}{item.specification ? ` (${item.specification})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20 space-y-1">
                      <Label className="text-xs">수량</Label>
                      <Input type="number" min={1} className="h-8 text-xs" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))} />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-xs">단가</Label>
                      <Input type="number" min={0} className="h-8 text-xs" value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', Number(e.target.value))} />
                    </div>
                    <div className="min-w-[80px] flex-1 space-y-1">
                      <Label className="text-xs">비고</Label>
                      <Input className="h-8 text-xs" value={line.remark} onChange={(e) => updateLine(idx, 'remark', e.target.value)} placeholder="선택" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={formLines.length <= 1} onClick={() => setFormLines(formLines.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '발주 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 발주 상세 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>발주서 상세 - {String(selectedOrder?.orderNo || '')}</span>
              <Button size="sm" variant="outline" onClick={handlePdfDownload} disabled={pdfLoading}>
                <FileDown className="mr-1.5 h-4 w-4" />
                {pdfLoading ? 'PDF 생성 중...' : '발주서 PDF'}
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">발주번호</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="font-mono text-sm font-bold">{String(selectedOrder.orderNo)}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">매입처</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm font-bold">
                      {(selectedOrder.partner as Record<string, string> | undefined)?.partnerName || '-'}
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">발주일</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm">{formatDate(String(selectedOrder.orderDate))}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">합계금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-status-info text-sm font-bold">
                      {formatCurrency(Number(selectedOrder.totalAmount))}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* 품목 상세 */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b text-xs">
                      <th className="px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-left">품명</th>
                      <th className="px-3 py-2 text-left">규격</th>
                      <th className="px-3 py-2 text-right">수량</th>
                      <th className="px-3 py-2 text-right">단가</th>
                      <th className="px-3 py-2 text-right">공급가액</th>
                      <th className="px-3 py-2 text-right">세액</th>
                      <th className="px-3 py-2 text-right">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderDetails.map((d, i) => {
                      const item = d.item as Record<string, string> | undefined
                      return (
                        <tr key={String(d.id)} className="border-b last:border-0">
                          <td className="px-3 py-2">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{item?.itemName || '-'}</td>
                          <td className="px-3 py-2">{item?.specification || '-'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{Number(d.quantity).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(d.unitPrice))}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(d.supplyAmount))}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(d.taxAmount))}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(Number(d.amount))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-bold">
                      <td colSpan={5} className="px-3 py-2 text-center">합계</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(selectedOrder.totalSupply))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(selectedOrder.totalTax))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(selectedOrder.totalAmount))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {typeof selectedOrder.description === 'string' && selectedOrder.description && (
                <div className="text-muted-foreground rounded-lg border p-3 text-sm">
                  <strong>비고:</strong> {selectedOrder.description}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

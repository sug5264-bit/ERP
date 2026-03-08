'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { SummaryCards } from '@/components/common/summary-cards'
import { PermissionGuard } from '@/components/common/permission-guard'
import { formatCurrency, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ClipboardList, Plus, Loader2, CheckCircle, DollarSign, FileDown } from 'lucide-react'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { generatePurchaseOrderPDF, type PurchaseOrderPDFData } from '@/lib/pdf-reports'

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

export default function PurchasingOrdersPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const qp = new URLSearchParams({ page: '1', pageSize: '50' })
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchasing-orders', startDate, endDate, statusFilter],
    queryFn: () => api.get(`/purchasing/orders?${qp.toString()}`),
  })

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
            <Button size="sm" onClick={() => toast.info('발주 등록 기능은 준비 중입니다.')}>
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

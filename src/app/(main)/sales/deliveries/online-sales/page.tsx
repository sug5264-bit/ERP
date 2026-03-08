'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/format'
import { exportToExcel, exportToPDF, downloadImportTemplate, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Plus, Trash2, FileDown } from 'lucide-react'
import { DateRangeFilter } from '@/components/common/date-range-filter'

const CHANNEL_MAP: Record<string, string> = {
  NAVER: '네이버 스토어',
  COUPANG: '쿠팡',
  GMARKET: 'G마켓',
  AUCTION: '옥션',
  '11ST': '11번가',
  SSG: 'SSG',
  KAKAO: '카카오 선물하기',
  SELF: '자사몰',
  OTHER: '기타',
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: '대기', variant: 'outline' },
  CONFIRMED: { label: '확정', variant: 'default' },
  CANCELLED: { label: '취소', variant: 'destructive' },
  REFUNDED: { label: '환불', variant: 'secondary' },
}

interface OnlineSaleRow {
  id: string
  saleNo: string
  saleDate: string
  channel: string
  platformOrderNo: string
  buyerName: string
  totalAmount: number
  totalFee: number
  status: string
  trackingNo: string
}

interface OnlineSaleItem {
  itemName: string
  quantity: number
  unitPrice: number
  platformFee: number
}

interface RevenueRow {
  id: string
  revenueDate: string
  channel: string
  description?: string
  totalSales: number
  totalFee: number
  netRevenue: number
  orderCount: number
  memo?: string
  createdAt: string
}

interface BulkRevenueEntry {
  revenueDate: string
  channel: string
  description: string
  totalSales: number
  totalFee: number
  orderCount: number
  memo: string
}

const emptyBulkEntry = (): BulkRevenueEntry => ({
  revenueDate: getLocalDateString(),
  channel: '',
  description: '',
  totalSales: 0,
  totalFee: 0,
  orderCount: 0,
  memo: '',
})

export default function OnlineSalesPage() {
  const queryClient = useQueryClient()
  const [mainTab, setMainTab] = useState('orders')
  const [open, setOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [channelFilter, setChannelFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [items, setItems] = useState<OnlineSaleItem[]>([{ itemName: '', quantity: 1, unitPrice: 0, platformFee: 0 }])
  const [bulkEntries, setBulkEntries] = useState<BulkRevenueEntry[]>([emptyBulkEntry()])

  const qp = new URLSearchParams({ pageSize: '50' })
  if (channelFilter && channelFilter !== 'all') qp.set('channel', channelFilter)
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  // Online sales query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['online-sales', channelFilter, startDate, endDate],
    queryFn: () => api.get(`/sales/online-sales?${qp.toString()}`) as Promise<Record<string, unknown>>,
  })

  // Revenue query
  const revQp = new URLSearchParams({ pageSize: '100' })
  if (channelFilter && channelFilter !== 'all') revQp.set('channel', channelFilter)
  if (startDate) revQp.set('startDate', startDate)
  if (endDate) revQp.set('endDate', endDate)

  const {
    data: revenueData,
    isLoading: revenueLoading,
    isError: revenueError,
    refetch: revenueRefetch,
  } = useQuery({
    queryKey: ['online-revenue', channelFilter, startDate, endDate],
    queryFn: () => api.get(`/sales/online-revenue?${revQp.toString()}`) as Promise<{ data: RevenueRow[] }>,
  })

  const revenues = useMemo(() => (revenueData?.data || []) as RevenueRow[], [revenueData?.data])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/online-sales', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-sales'] })
      setOpen(false)
      setItems([{ itemName: '', quantity: 1, unitPrice: 0, platformFee: 0 }])
      toast.success('온라인 매출이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const bulkRevenueMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/online-revenue', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-revenue'] })
      setBulkOpen(false)
      setBulkEntries([emptyBulkEntry()])
      toast.success('매출이 일괄 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      saleDate: form.get('saleDate'),
      channel: form.get('channel'),
      platformOrderNo: form.get('platformOrderNo') || undefined,
      buyerName: form.get('buyerName') || undefined,
      buyerPhone: form.get('buyerPhone') || undefined,
      shippingAddress: form.get('shippingAddress') || undefined,
      trackingNo: form.get('trackingNo') || undefined,
      memo: form.get('memo') || undefined,
      items: items.filter((i) => i.itemName),
    })
  }

  const handleBulkSubmit = () => {
    const validEntries = bulkEntries.filter((e) => e.channel && e.totalSales > 0)
    if (validEntries.length === 0) {
      toast.error('최소 1개 이상의 유효한 매출 항목이 필요합니다.')
      return
    }
    bulkRevenueMutation.mutate({
      entries: validEntries.map((e) => ({
        revenueDate: e.revenueDate,
        channel: e.channel,
        description: e.description || undefined,
        totalSales: e.totalSales,
        totalFee: e.totalFee || 0,
        orderCount: e.orderCount || 0,
        memo: e.memo || undefined,
      })),
    })
  }

  const updateItem = (idx: number, field: string, value: string | number) => {
    const updated = [...items]
    ;(updated[idx] as unknown as Record<string, string | number>)[field] = value
    setItems(updated)
  }

  const updateBulkEntry = (idx: number, field: keyof BulkRevenueEntry, value: string | number) => {
    const updated = [...bulkEntries]
    ;(updated[idx] as unknown as Record<string, string | number>)[field] = value
    setBulkEntries(updated)
  }

  const sales: OnlineSaleRow[] = (data?.data as OnlineSaleRow[]) || []

  // Summary
  const totalSales = sales.reduce((s: number, r: OnlineSaleRow) => s + Number(r.totalAmount || 0), 0)
  const totalFees = sales.reduce((s: number, r: OnlineSaleRow) => s + Number(r.totalFee || 0), 0)
  const netSales = totalSales - totalFees

  // Revenue summary
  const revTotalSales = revenues.reduce((s: number, r: RevenueRow) => s + Number(r.totalSales || 0), 0)
  const revTotalFees = revenues.reduce((s: number, r: RevenueRow) => s + Number(r.totalFee || 0), 0)
  const revNetRevenue = revenues.reduce((s: number, r: RevenueRow) => s + Number(r.netRevenue || 0), 0)
  const revTotalOrders = revenues.reduce((s: number, r: RevenueRow) => s + Number(r.orderCount || 0), 0)

  const columns: ColumnDef<OnlineSaleRow>[] = [
    {
      accessorKey: 'saleNo',
      header: '매출번호',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.saleNo || row.original.id?.slice(0, 8)}</span>
      ),
    },
    { id: 'saleDate', header: '매출일', cell: ({ row }) => formatDate(row.original.saleDate) },
    {
      id: 'channel',
      header: '판매채널',
      cell: ({ row }) => <Badge variant="outline">{CHANNEL_MAP[row.original.channel] || row.original.channel}</Badge>,
    },
    {
      id: 'platformOrderNo',
      header: '플랫폼주문번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.platformOrderNo || '-'}</span>,
    },
    { id: 'buyerName', header: '구매자', cell: ({ row }) => row.original.buyerName || '-' },
    {
      id: 'totalAmount',
      header: '매출액',
      cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount || 0)}</span>,
    },
    {
      id: 'totalFee',
      header: '수수료',
      cell: ({ row }) => <span className="text-status-danger">{formatCurrency(row.original.totalFee || 0)}</span>,
    },
    {
      id: 'netAmount',
      header: '순매출',
      cell: ({ row }) => (
        <span className="text-status-success font-medium">
          {formatCurrency((row.original.totalAmount || 0) - (row.original.totalFee || 0))}
        </span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => {
        const s = STATUS_MAP[row.original.status]
        return s ? (
          <Badge variant={s.variant}>{s.label}</Badge>
        ) : (
          <Badge variant="outline">{row.original.status || '대기'}</Badge>
        )
      },
    },
    {
      id: 'trackingNo',
      header: '운송장',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.trackingNo || '-'}</span>,
    },
  ]

  const revenueColumns: ColumnDef<RevenueRow>[] = [
    { id: 'revenueDate', header: '매출일', cell: ({ row }) => formatDate(row.original.revenueDate) },
    {
      id: 'channel',
      header: '판매채널',
      cell: ({ row }) => <Badge variant="outline">{CHANNEL_MAP[row.original.channel] || row.original.channel}</Badge>,
    },
    { id: 'description', header: '설명', cell: ({ row }) => row.original.description || '-' },
    {
      id: 'orderCount',
      header: '주문건수',
      cell: ({ row }) => `${row.original.orderCount}건`,
    },
    {
      id: 'totalSales',
      header: '총매출',
      cell: ({ row }) => <span className="font-medium">{formatCurrency(Number(row.original.totalSales))}</span>,
    },
    {
      id: 'totalFee',
      header: '수수료',
      cell: ({ row }) => <span className="text-status-danger">{formatCurrency(Number(row.original.totalFee))}</span>,
    },
    {
      id: 'netRevenue',
      header: '순매출',
      cell: ({ row }) => (
        <span className="text-status-success font-medium">{formatCurrency(Number(row.original.netRevenue))}</span>
      ),
    },
    {
      id: 'memo',
      header: '메모',
      cell: ({ row }) => (
        <span className="text-muted-foreground max-w-[200px] truncate text-xs">{row.original.memo || '-'}</span>
      ),
    },
  ]

  const exportColumns: ExportColumn[] = [
    { header: '매출번호', accessor: (r) => r.saleNo || '' },
    { header: '매출일', accessor: (r) => formatDate(r.saleDate) },
    { header: '판매채널', accessor: (r) => CHANNEL_MAP[r.channel] || r.channel },
    { header: '플랫폼주문번호', accessor: (r) => r.platformOrderNo || '' },
    { header: '구매자', accessor: (r) => r.buyerName || '' },
    { header: '매출액', accessor: (r) => formatCurrency(r.totalAmount || 0) },
    { header: '수수료', accessor: (r) => formatCurrency(r.totalFee || 0) },
    { header: '순매출', accessor: (r) => formatCurrency((r.totalAmount || 0) - (r.totalFee || 0)) },
    { header: '운송장번호', accessor: (r) => r.trackingNo || '' },
  ]

  const revenueExportColumns: ExportColumn[] = [
    { header: '매출일', accessor: (r) => formatDate(r.revenueDate) },
    { header: '판매채널', accessor: (r) => CHANNEL_MAP[r.channel] || r.channel },
    { header: '설명', accessor: (r) => r.description || '' },
    { header: '주문건수', accessor: (r) => `${r.orderCount}건` },
    { header: '총매출', accessor: (r) => formatCurrency(Number(r.totalSales)) },
    { header: '수수료', accessor: (r) => formatCurrency(Number(r.totalFee)) },
    { header: '순매출', accessor: (r) => formatCurrency(Number(r.netRevenue)) },
    { header: '메모', accessor: (r) => r.memo || '' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = {
      fileName: '온라인매출목록',
      title: '온라인 매출 목록',
      columns: exportColumns,
      data: sales,
    }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const handleRevenueExport = (type: 'excel' | 'pdf') => {
    const cfg = {
      fileName: '온라인매출_일괄',
      title: '온라인 매출 일괄 내역',
      columns: revenueExportColumns,
      data: revenues,
    }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const handleTemplateDownload = () => {
    downloadImportTemplate({
      fileName: '온라인매출_업로드_템플릿',
      sheetName: '온라인매출',
      columns: [
        { header: '매출일', key: 'saleDate', example: '2026-02-26', width: 14, required: true },
        { header: '판매채널', key: 'channel', example: 'NAVER', width: 12, required: true },
        { header: '플랫폼주문번호', key: 'platformOrderNo', example: '20260226001', width: 18 },
        { header: '구매자', key: 'buyerName', example: '홍길동', width: 12 },
        { header: '구매자 연락처', key: 'buyerPhone', example: '010-1234-5678', width: 16 },
        { header: '배송지', key: 'shippingAddress', example: '서울시 강남구', width: 28 },
        { header: '상품명', key: 'itemName', example: '상품A', width: 18 },
        { header: '수량', key: 'quantity', example: '1', width: 8, required: true },
        { header: '단가', key: 'unitPrice', example: '50000', width: 12, required: true },
        { header: '수수료', key: 'platformFee', example: '5000', width: 10 },
        { header: '운송장번호', key: 'trackingNo', example: '', width: 16 },
        { header: '메모', key: 'memo', example: '', width: 20 },
      ],
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="온라인 매출"
        description="온라인 판매 채널별 매출을 등록하고 관리합니다. 판매가 변동 시 매출을 별도로 일괄 기입할 수 있습니다."
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => {
          setStartDate(s)
          setEndDate(e)
        }}
      />

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="orders">주문별 매출</TabsTrigger>
          <TabsTrigger value="bulk">매출 일괄 기입</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4 pt-2">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
            <div className="bg-muted/30 rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">전체 건수</p>
              <p className="text-sm font-bold sm:text-lg">
                {sales.length}
                <span className="text-muted-foreground ml-0.5 text-xs font-normal">건</span>
              </p>
            </div>
            <div className="bg-status-info-muted rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">총 매출</p>
              <p className="text-status-info text-sm font-bold sm:text-lg">{formatCurrency(totalSales)}</p>
            </div>
            <div className="bg-status-danger-muted rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">수수료</p>
              <p className="text-status-danger text-sm font-bold sm:text-lg">{formatCurrency(totalFees)}</p>
            </div>
            <div className="bg-status-success-muted rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">순매출</p>
              <p className="text-status-success text-sm font-bold sm:text-lg">{formatCurrency(netSales)}</p>
            </div>
          </div>

          {/* Filters + actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="전체 채널" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 채널</SelectItem>
                {Object.entries(CHANNEL_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)}>매출 등록</Button>
            <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
              <FileDown className="mr-1 h-3.5 w-3.5" /> 템플릿
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={sales}
            searchColumn="saleNo"
            searchPlaceholder="매출번호로 검색..."
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            pageSize={50}
            onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
          />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4 pt-2">
          {/* Revenue summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-4">
            <div className="bg-muted/30 rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">등록 건수</p>
              <p className="text-sm font-bold sm:text-lg">{revenues.length}건</p>
            </div>
            <div className="rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">총 주문수</p>
              <p className="text-sm font-bold sm:text-lg">{revTotalOrders}건</p>
            </div>
            <div className="bg-status-info-muted rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">총 매출</p>
              <p className="text-status-info text-sm font-bold sm:text-lg">{formatCurrency(revTotalSales)}</p>
            </div>
            <div className="bg-status-danger-muted rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">총 수수료</p>
              <p className="text-status-danger text-sm font-bold sm:text-lg">{formatCurrency(revTotalFees)}</p>
            </div>
            <div className="bg-status-success-muted rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">순매출</p>
              <p className="text-status-success text-sm font-bold sm:text-lg">{formatCurrency(revNetRevenue)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setBulkOpen(true)}>매출 일괄 등록</Button>
            <p className="text-muted-foreground text-xs">
              온라인 판매가가 수시로 변동되는 경우, 채널별/기간별 매출을 통으로 기입할 수 있습니다.
            </p>
          </div>

          <DataTable
            columns={revenueColumns}
            data={revenues}
            searchColumn="channel"
            searchPlaceholder="채널로 검색..."
            isLoading={revenueLoading}
            isError={revenueError}
            onRetry={() => revenueRefetch()}
            pageSize={50}
            onExport={{ excel: () => handleRevenueExport('excel'), pdf: () => handleRevenueExport('pdf') }}
          />
        </TabsContent>
      </Tabs>

      {/* Create dialog (single) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>온라인 매출 등록</DialogTitle>
            <p className="text-muted-foreground text-xs">
              <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
            </p>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  매출일 <span className="text-destructive">*</span>
                </Label>
                <Input name="saleDate" type="date" required aria-required="true" defaultValue={getLocalDateString()} />
              </div>
              <div className="space-y-2">
                <Label>
                  판매채널 <span className="text-destructive">*</span>
                </Label>
                <Select name="channel" required>
                  <SelectTrigger>
                    <SelectValue placeholder="채널 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>플랫폼 주문번호</Label>
                <Input name="platformOrderNo" placeholder="플랫폼 주문번호" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>구매자</Label>
                <Input name="buyerName" placeholder="구매자명" />
              </div>
              <div className="space-y-2">
                <Label>연락처</Label>
                <Input name="buyerPhone" placeholder="010-0000-0000" />
              </div>
              <div className="space-y-2">
                <Label>운송장번호</Label>
                <Input name="trackingNo" placeholder="운송장번호" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>배송지</Label>
              <Input name="shippingAddress" placeholder="배송지 주소" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">상품 내역</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setItems([...items, { itemName: '', quantity: 1, unitPrice: 0, platformFee: 0 }])}
                >
                  <Plus className="mr-1 h-3 w-3" /> 행 추가
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[500px] text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-2 py-2 text-left font-medium">
                        상품명 <span className="text-destructive">*</span>
                      </th>
                      <th className="px-2 py-2 text-right font-medium">수량</th>
                      <th className="px-2 py-2 text-right font-medium">단가</th>
                      <th className="px-2 py-2 text-right font-medium">금액</th>
                      <th className="px-2 py-2 text-right font-medium">수수료</th>
                      <th className="px-2 py-2 text-right font-medium">순매출</th>
                      <th className="w-8 px-1 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const amount = item.quantity * item.unitPrice
                      const net = amount - item.platformFee
                      return (
                        <tr key={idx} className="border-b last:border-b-0">
                          <td className="px-1 py-1.5">
                            <Input
                              className="h-7 min-w-[140px] text-xs"
                              value={item.itemName}
                              onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                              placeholder="상품명 입력"
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <Input
                              type="number"
                              className="h-7 w-[70px] text-right text-xs"
                              value={item.quantity || ''}
                              onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <Input
                              type="number"
                              className="h-7 w-[90px] text-right text-xs"
                              value={item.unitPrice || ''}
                              onChange={(e) => updateItem(idx, 'unitPrice', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono font-medium whitespace-nowrap">
                            {formatCurrency(amount)}
                          </td>
                          <td className="px-1 py-1.5">
                            <Input
                              type="number"
                              className="h-7 w-[80px] text-right text-xs"
                              value={item.platformFee || ''}
                              onChange={(e) => updateItem(idx, 'platformFee', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="text-status-success px-2 py-1.5 text-right font-mono font-medium whitespace-nowrap">
                            {formatCurrency(net)}
                          </td>
                          <td className="px-1 py-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))}
                              disabled={items.length <= 1}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t">
                      <td className="px-2 py-2 text-xs font-medium">합계</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">
                        {items.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      <td></td>
                      <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                        {formatCurrency(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))}
                      </td>
                      <td className="text-status-danger px-2 py-2 text-right font-mono text-xs">
                        {formatCurrency(items.reduce((s, i) => s + i.platformFee, 0))}
                      </td>
                      <td className="text-status-success px-2 py-2 text-right font-mono text-xs font-medium">
                        {formatCurrency(items.reduce((s, i) => s + i.quantity * i.unitPrice - i.platformFee, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea name="memo" placeholder="메모 (선택)" rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '매출 등록'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk revenue dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>매출 일괄 등록</DialogTitle>
            <p className="text-muted-foreground text-xs">
              판매가가 수시로 변동되는 온라인 매출을 채널별/기간별로 통으로 기입합니다.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">매출 내역</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setBulkEntries([...bulkEntries, emptyBulkEntry()])}
              >
                <Plus className="mr-1 h-3 w-3" /> 행 추가
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[800px] text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-2 py-2 text-left font-medium">
                      매출일 <span className="text-destructive">*</span>
                    </th>
                    <th className="px-2 py-2 text-left font-medium">
                      채널 <span className="text-destructive">*</span>
                    </th>
                    <th className="px-2 py-2 text-left font-medium">설명</th>
                    <th className="px-2 py-2 text-right font-medium">주문건수</th>
                    <th className="px-2 py-2 text-right font-medium">
                      총매출 <span className="text-destructive">*</span>
                    </th>
                    <th className="px-2 py-2 text-right font-medium">수수료</th>
                    <th className="px-2 py-2 text-right font-medium">순매출</th>
                    <th className="w-8 px-1 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkEntries.map((entry, idx) => (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="px-1 py-1.5">
                        <Input
                          type="date"
                          className="h-7 w-[130px] text-xs"
                          value={entry.revenueDate}
                          onChange={(e) => updateBulkEntry(idx, 'revenueDate', e.target.value)}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Select
                          value={entry.channel}
                          onValueChange={(v) => updateBulkEntry(idx, 'channel', v)}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs">
                            <SelectValue placeholder="채널" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CHANNEL_MAP).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          className="h-7 min-w-[100px] text-xs"
                          value={entry.description}
                          onChange={(e) => updateBulkEntry(idx, 'description', e.target.value)}
                          placeholder="3월 1주차 등"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          className="h-7 w-[70px] text-right text-xs"
                          value={entry.orderCount || ''}
                          onChange={(e) => updateBulkEntry(idx, 'orderCount', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          className="h-7 w-[110px] text-right text-xs"
                          value={entry.totalSales || ''}
                          onChange={(e) => updateBulkEntry(idx, 'totalSales', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          className="h-7 w-[90px] text-right text-xs"
                          value={entry.totalFee || ''}
                          onChange={(e) => updateBulkEntry(idx, 'totalFee', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="text-status-success px-2 py-1.5 text-right font-mono font-medium whitespace-nowrap">
                        {formatCurrency(entry.totalSales - entry.totalFee)}
                      </td>
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            bulkEntries.length > 1 && setBulkEntries(bulkEntries.filter((_, i) => i !== idx))
                          }
                          disabled={bulkEntries.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t">
                    <td colSpan={3} className="px-2 py-2 text-xs font-medium">
                      합계 ({bulkEntries.filter((e) => e.channel && e.totalSales > 0).length}건)
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {bulkEntries.reduce((s, e) => s + e.orderCount, 0)}건
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                      {formatCurrency(bulkEntries.reduce((s, e) => s + e.totalSales, 0))}
                    </td>
                    <td className="text-status-danger px-2 py-2 text-right font-mono text-xs">
                      {formatCurrency(bulkEntries.reduce((s, e) => s + e.totalFee, 0))}
                    </td>
                    <td className="text-status-success px-2 py-2 text-right font-mono text-xs font-medium">
                      {formatCurrency(bulkEntries.reduce((s, e) => s + e.totalSales - e.totalFee, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Button
              className="w-full"
              onClick={handleBulkSubmit}
              disabled={bulkRevenueMutation.isPending}
            >
              {bulkRevenueMutation.isPending ? '등록 중...' : '매출 일괄 등록'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

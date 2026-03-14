'use client'

import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, downloadImportTemplate, type ExportColumn } from '@/lib/export'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { toast } from 'sonner'
import {
  CheckCircle,
  Clock,
  Package,
  Upload,
  Paperclip,
  X,
  Eye,
  FileDown,
  RefreshCw,
  Filter,
  Table2,
  CalendarDays,
} from 'lucide-react'

const STATUS_MAP: Record<string, string> = {
  PREPARING: '준비중',
  SHIPPED: '출하',
  DELIVERED: '납품완료',
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'PREPARING', label: '준비중' },
  { value: 'SHIPPED', label: '출하' },
  { value: 'DELIVERED', label: '납품완료' },
]

interface DeliveryDetailRow {
  item?: { id: string; itemName: string; barcode?: string; specification?: string; unit?: string; itemCode?: string }
  quantity: number
  unitPrice: number
  amount: number
}

interface DeliveryRow {
  id: string
  deliveryNo: string
  deliveryDate: string
  deliveryAddress?: string
  status: string
  carrier?: string
  trackingNo?: string
  orderConfirmed: boolean
  orderConfirmedAt?: string
  shipmentCompleted: boolean
  shipmentCompletedAt?: string
  actualRevenue?: number
  platformFee?: number
  revenueNote?: string
  partner?: { partnerName: string; bizNo?: string }
  salesOrder?: {
    orderNo: string
    orderDate?: string
    status?: string
    salesChannel?: string
    siteName?: string
    ordererName?: string
    ordererContact?: string
    recipientName?: string
    recipientContact?: string
    recipientZipCode?: string
    recipientAddress?: string
    requirements?: string
    trackingNo?: string
  }
  details?: DeliveryDetailRow[]
}

interface AttachmentRow {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
}

interface ApiListResponse<T> {
  data: T[]
}

// Flatten delivery rows to one row per item for the detail table
interface FlatRow {
  _deliveryId: string
  _delivery: DeliveryRow
  orderDate: string
  barcode: string
  orderNo: string
  siteName: string
  itemName: string
  quantity: number
  ordererName: string
  recipientName: string
  ordererContact: string
  recipientContact: string
  zipCode: string
  address: string
  requirements: string
  status: string
  trackingNo: string
}

function flattenDeliveries(deliveries: DeliveryRow[]): FlatRow[] {
  const rows: FlatRow[] = []
  for (const d of deliveries) {
    const so = d.salesOrder
    if (d.details && d.details.length > 0) {
      for (const det of d.details) {
        rows.push({
          _deliveryId: d.id,
          _delivery: d,
          orderDate: so?.orderDate || d.deliveryDate,
          barcode: det.item?.barcode || '',
          orderNo: so?.orderNo || d.deliveryNo,
          siteName: so?.siteName || '-',
          itemName: det.item?.itemName || '-',
          quantity: det.quantity,
          ordererName: so?.ordererName || '-',
          recipientName: so?.recipientName || '-',
          ordererContact: so?.ordererContact || '-',
          recipientContact: so?.recipientContact || '-',
          zipCode: so?.recipientZipCode || '-',
          address: so?.recipientAddress || '-',
          requirements: so?.requirements || '-',
          status: d.status,
          trackingNo: d.trackingNo || so?.trackingNo || '-',
        })
      }
    } else {
      rows.push({
        _deliveryId: d.id,
        _delivery: d,
        orderDate: so?.orderDate || d.deliveryDate,
        barcode: '',
        orderNo: so?.orderNo || d.deliveryNo,
        siteName: so?.siteName || '-',
        itemName: '-',
        quantity: 0,
        ordererName: so?.ordererName || '-',
        recipientName: so?.recipientName || '-',
        ordererContact: so?.ordererContact || '-',
        recipientContact: so?.recipientContact || '-',
        zipCode: so?.recipientZipCode || '-',
        address: so?.recipientAddress || '-',
        requirements: so?.requirements || '-',
        status: d.status,
        trackingNo: d.trackingNo || so?.trackingNo || '-',
      })
    }
  }
  return rows
}

export default function OrderTrackingPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false)
  const [revenueTarget, setRevenueTarget] = useState<DeliveryRow | null>(null)
  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachTarget, setAttachTarget] = useState<DeliveryRow | null>(null)
  const [attachments, setAttachments] = useState<AttachmentRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const trackingFileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '200' })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    return params.toString()
  }, [startDate, endDate, statusFilter])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['delivery-tracking', queryParams],
    queryFn: () => api.get(`/sales/deliveries?${queryParams}`) as Promise<ApiListResponse<DeliveryRow>>,
  })

  const deliveries = useMemo(() => data?.data || [], [data?.data])
  const flatRows = useMemo(() => flattenDeliveries(deliveries), [deliveries])

  // Filter by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return flatRows
    const term = searchTerm.toLowerCase()
    return flatRows.filter(
      (r) =>
        r.orderNo.toLowerCase().includes(term) ||
        r.itemName.toLowerCase().includes(term) ||
        r.ordererName.toLowerCase().includes(term) ||
        r.recipientName.toLowerCase().includes(term) ||
        r.barcode.toLowerCase().includes(term) ||
        r.siteName.toLowerCase().includes(term)
    )
  }, [flatRows, searchTerm])

  // Toggle mutations
  const toggleOrderConfirmed = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.patch(`/sales/deliveries/${id}`, { orderConfirmed: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-tracking'] })
      toast.success('수주 상태가 업데이트되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleShipmentCompleted = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.patch(`/sales/deliveries/${id}`, {
        shipmentCompleted: value,
        ...(value ? { status: 'SHIPPED' } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-tracking'] })
      toast.success('출하 상태가 업데이트되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateRevenueMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; actualRevenue?: number; platformFee?: number; revenueNote?: string }) =>
      api.patch(`/sales/deliveries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-tracking'] })
      setRevenueDialogOpen(false)
      setRevenueTarget(null)
      toast.success('매출 정보가 업데이트되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !attachTarget) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('relatedTable', 'Delivery')
      formData.append('relatedId', attachTarget.id)
      await api.upload('/attachments', formData)
      toast.success('파일이 업로드되었습니다.')
      loadAttachments(attachTarget.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '파일 업로드 실패')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTrackingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.upload('/sales/deliveries/tracking-upload', formData)
      toast.success('운송장이 업로드되었습니다.')
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '운송장 업로드 실패')
    }
    if (trackingFileRef.current) trackingFileRef.current.value = ''
  }

  const loadAttachments = async (deliveryId: string) => {
    try {
      const res = (await api.get(`/attachments?relatedTable=Delivery&relatedId=${deliveryId}`)) as {
        data?: AttachmentRow[]
      }
      setAttachments(res?.data || [])
    } catch {
      setAttachments([])
    }
  }

  const openAttachments = (delivery: DeliveryRow) => {
    setAttachTarget(delivery)
    setAttachDialogOpen(true)
    loadAttachments(delivery.id)
  }

  const deleteAttachment = async (attachmentId: string) => {
    try {
      await api.delete(`/attachments/${attachmentId}`)
      toast.success('파일이 삭제되었습니다.')
      if (attachTarget) loadAttachments(attachTarget.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  // Summary stats
  const summary = useMemo(() => {
    const total = deliveries.length
    const confirmed = deliveries.filter((d: DeliveryRow) => d.orderConfirmed).length
    const shipped = deliveries.filter((d: DeliveryRow) => d.shipmentCompleted).length
    const pending = confirmed - shipped
    return { total, confirmed, shipped, pending }
  }, [deliveries])

  const columns: ColumnDef<FlatRow>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="전체 선택"
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="행 선택" />
      ),
      enableSorting: false,
    },
    {
      id: 'orderDate',
      header: '주문일',
      cell: ({ row }) => <span className="text-xs whitespace-nowrap">{formatDate(row.original.orderDate)}</span>,
    },
    {
      id: 'barcode',
      header: '상품바코드',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.barcode || '-'}</span>,
    },
    {
      accessorKey: 'orderNo',
      header: '주문번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span>,
      enableSorting: true,
    },
    {
      id: 'siteName',
      header: '사이트명',
      cell: ({ row }) => <span className="text-xs">{row.original.siteName}</span>,
    },
    {
      id: 'itemName',
      header: '상품명',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate text-xs" title={row.original.itemName}>
          {row.original.itemName}
        </span>
      ),
    },
    {
      id: 'quantity',
      header: '수량',
      cell: ({ row }) => <span className="text-xs">{row.original.quantity}</span>,
    },
    {
      id: 'ordererName',
      header: '주문자',
      cell: ({ row }) => <span className="text-xs">{row.original.ordererName}</span>,
    },
    {
      id: 'recipientName',
      header: '수취인',
      cell: ({ row }) => <span className="text-xs">{row.original.recipientName}</span>,
    },
    {
      id: 'ordererContact',
      header: '주문자 연락처',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.ordererContact}</span>,
    },
    {
      id: 'recipientContact',
      header: '수취인 연락처',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.recipientContact}</span>,
    },
    {
      id: 'zipCode',
      header: '우편번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.zipCode}</span>,
    },
    {
      id: 'address',
      header: '주소',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate text-xs" title={row.original.address}>
          {row.original.address}
        </span>
      ),
    },
    {
      id: 'requirements',
      header: '요구사항',
      cell: ({ row }) => (
        <span className="max-w-[150px] truncate text-xs" title={row.original.requirements}>
          {row.original.requirements}
        </span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => <StatusBadge status={row.original.status} labels={STATUS_MAP} />,
    },
    {
      id: 'trackingNo',
      header: '운송장',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.trackingNo}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openAttachments(row.original._delivery)}
            title="첨부파일"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setRevenueTarget(row.original._delivery)
              setRevenueDialogOpen(true)
            }}
          >
            매출
          </Button>
        </div>
      ),
    },
  ]

  const exportColumns: ExportColumn[] = [
    { header: '주문일', accessor: (r) => formatDate(r.orderDate) },
    { header: '상품바코드', accessor: (r) => r.barcode || '' },
    { header: '주문번호', accessor: (r) => r.orderNo },
    { header: '사이트명', accessor: (r) => r.siteName },
    { header: '상품명', accessor: (r) => r.itemName },
    { header: '수량', accessor: (r) => String(r.quantity) },
    { header: '주문자', accessor: (r) => r.ordererName },
    { header: '수취인', accessor: (r) => r.recipientName },
    { header: '주문자 연락처', accessor: (r) => r.ordererContact },
    { header: '수취인 연락처', accessor: (r) => r.recipientContact },
    { header: '우편번호', accessor: (r) => r.zipCode },
    { header: '주소', accessor: (r) => r.address },
    { header: '요구사항', accessor: (r) => r.requirements },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status] || r.status },
    { header: '운송장', accessor: (r) => r.trackingNo },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = {
      fileName: '수주출하관리',
      title: '수주/출하 관리',
      columns: exportColumns,
      data: filteredRows,
    }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const handleTemplateDownload = () => {
    downloadImportTemplate({
      fileName: '수주_업로드_템플릿',
      sheetName: '수주',
      columns: [
        { header: '주문일', key: 'orderDate', example: '2026-03-11', width: 14, required: true },
        { header: '상품바코드', key: 'barcode', example: '8801234567890', width: 16 },
        { header: '주문번호', key: 'orderNo', example: 'SO-20260311-001', width: 18, required: true },
        { header: '사이트명', key: 'siteName', example: '네이버 스토어', width: 14 },
        { header: '상품명', key: 'itemName', example: '상품A', width: 18, required: true },
        { header: '수량', key: 'quantity', example: '1', width: 8, required: true },
        { header: '단가', key: 'unitPrice', example: '50000', width: 12, required: true },
        { header: '주문자', key: 'ordererName', example: '홍길동', width: 12 },
        { header: '주문자 연락처', key: 'ordererContact', example: '010-1234-5678', width: 16 },
        { header: '수취인', key: 'recipientName', example: '김철수', width: 12 },
        { header: '수취인 연락처', key: 'recipientContact', example: '010-9876-5432', width: 16 },
        { header: '우편번호', key: 'recipientZipCode', example: '06236', width: 10 },
        { header: '주소', key: 'recipientAddress', example: '서울시 강남구 테헤란로 1', width: 30 },
        { header: '요구사항', key: 'requirements', example: '부재시 문앞', width: 20 },
        { header: '운송장번호', key: 'trackingNo', example: '', width: 16 },
      ],
    })
  }

  const handleRevenueSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!revenueTarget) return
    const form = new FormData(e.currentTarget)
    updateRevenueMutation.mutate({
      id: revenueTarget.id,
      actualRevenue: parseFloat(form.get('actualRevenue') as string) || 0,
      platformFee: parseFloat(form.get('platformFee') as string) || 0,
      revenueNote: (form.get('revenueNote') as string) || undefined,
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="수주/출하 추적" description="수주 확인 및 출하 상태를 관리합니다." />

      {/* Top filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />

        <div className="relative flex-1 sm:max-w-sm">
          <Input
            placeholder="주문번호 / 거래처 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-8"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="필터 초기화"
          onClick={() => {
            setStatusFilter('all')
            setStartDate('')
            setEndDate('')
            setSearchTerm('')
          }}
        >
          <Filter className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9" title="새로고침" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>

        <div className="ml-auto flex rounded-lg border">
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1 rounded-r-none"
            onClick={() => setViewMode('table')}
          >
            <Table2 className="h-4 w-4" /> 테이블
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1 rounded-l-none"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="h-4 w-4" /> 캘린더
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
          <FileDown className="mr-1 h-3.5 w-3.5" /> 수주 템플릿
        </Button>
        <Button variant="outline" size="sm" onClick={() => trackingFileRef.current?.click()}>
          <Upload className="mr-1 h-3.5 w-3.5" /> 운송장 업로드
        </Button>
        <input
          ref={trackingFileRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleTrackingUpload}
        />
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Package className="h-3 w-3" /> 전체 {summary.total}건
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> 수주확인 {summary.confirmed}건
        </Badge>
        <Badge variant="secondary" className="gap-1 text-orange-600">
          출하대기 {summary.pending}건
        </Badge>
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" /> 출하완료 {summary.shipped}건
        </Badge>
      </div>

      {/* Data table */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={filteredRows}
          searchColumn="orderNo"
          searchPlaceholder="주문번호로 검색..."
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          pageSize={50}
          onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
        />
      ) : (
        <div className="bg-muted/30 rounded-lg border p-8 text-center">
          <CalendarDays className="text-muted-foreground mx-auto mb-2 h-12 w-12" />
          <p className="text-muted-foreground text-sm">캘린더 뷰는 준비 중입니다.</p>
        </div>
      )}

      {/* Revenue input dialog */}
      <Dialog open={revenueDialogOpen} onOpenChange={setRevenueDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>매출 정보 입력 - {revenueTarget?.deliveryNo}</DialogTitle>
            <DialogDescription>실제 매출액과 수수료를 기입합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRevenueSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">출하금액 (참고)</Label>
                <p className="text-sm font-medium">
                  {formatCurrency(
                    revenueTarget?.details?.reduce((s: number, d: DeliveryDetailRow) => s + Number(d.amount), 0) || 0
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">실제 매출액</Label>
                <Input
                  name="actualRevenue"
                  type="number"
                  step="1"
                  className="h-8 text-xs"
                  defaultValue={revenueTarget?.actualRevenue || ''}
                  placeholder="실제 판매된 금액"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">플랫폼 수수료</Label>
                <Input
                  name="platformFee"
                  type="number"
                  step="1"
                  className="h-8 text-xs"
                  defaultValue={revenueTarget?.platformFee || ''}
                  placeholder="판매 수수료"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">메모</Label>
                <Textarea
                  name="revenueNote"
                  className="text-xs"
                  rows={2}
                  defaultValue={revenueTarget?.revenueNote || ''}
                  placeholder="매출 관련 메모"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={updateRevenueMutation.isPending}>
              {updateRevenueMutation.isPending ? '저장 중...' : '매출 정보 저장'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Attachments dialog */}
      <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>첨부파일 - {attachTarget?.deliveryNo}</DialogTitle>
            <DialogDescription>거래명세서, 인수증 등 출고 관련 서류를 관리합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> 파일 업로드
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.gif,.zip"
                onChange={handleFileUpload}
              />
              <span className="text-muted-foreground text-xs">최대 50MB</span>
            </div>
            {attachments.length > 0 ? (
              <div className="space-y-1">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{att.fileName}</p>
                        <p className="text-muted-foreground text-[10px]">
                          {formatFileSize(att.fileSize)} · {formatDate(att.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={`/api/v1/attachments/${att.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-muted rounded p-1"
                        title="다운로드"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteAttachment(att.id)}
                        title="삭제"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-6 text-center text-xs">첨부파일이 없습니다.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

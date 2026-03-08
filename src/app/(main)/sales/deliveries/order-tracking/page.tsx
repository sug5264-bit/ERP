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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { toast } from 'sonner'
import { CheckCircle, Clock, Package, Upload, Paperclip, X, Eye } from 'lucide-react'

const STATUS_MAP: Record<string, string> = {
  PREPARING: '준비중',
  SHIPPED: '출하',
  DELIVERED: '납품완료',
}

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
  salesOrder?: { orderNo: string; orderDate?: string; status?: string; salesChannel?: string }
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

export default function OrderTrackingPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false)
  const [revenueTarget, setRevenueTarget] = useState<DeliveryRow | null>(null)
  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachTarget, setAttachTarget] = useState<DeliveryRow | null>(null)
  const [attachments, setAttachments] = useState<AttachmentRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ pageSize: '200' })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (activeTab === 'pending') {
      params.set('orderConfirmed', 'true')
      params.set('shipmentCompleted', 'false')
    } else if (activeTab === 'completed') {
      params.set('shipmentCompleted', 'true')
    } else if (activeTab === 'unconfirmed') {
      params.set('orderConfirmed', 'false')
    }
    return params.toString()
  }, [startDate, endDate, activeTab])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['delivery-tracking', queryParams],
    queryFn: () =>
      api.get(`/sales/deliveries?${queryParams}`) as Promise<ApiListResponse<DeliveryRow>>,
  })

  const deliveries = useMemo(() => data?.data || [], [data?.data])

  // Toggle mutations
  const toggleOrderConfirmed = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.patch(`/sales/deliveries/${id}`, { orderConfirmed: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-tracking'] })
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
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
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
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

  const loadAttachments = async (deliveryId: string) => {
    try {
      const res = (await api.get(
        `/attachments?relatedTable=Delivery&relatedId=${deliveryId}`
      )) as { data?: AttachmentRow[] }
      setAttachments(Array.isArray(res) ? res : res.data || [])
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
    const totalAmount = deliveries.reduce(
      (s: number, d: DeliveryRow) =>
        s + (d.details?.reduce((ds: number, det: DeliveryDetailRow) => ds + Number(det.amount), 0) || 0),
      0
    )
    const totalRevenue = deliveries.reduce(
      (s: number, d: DeliveryRow) => s + Number(d.actualRevenue || 0),
      0
    )
    return { total, confirmed, shipped, pending, totalAmount, totalRevenue }
  }, [deliveries])

  const columns: ColumnDef<DeliveryRow>[] = [
    {
      id: 'orderConfirmed',
      header: '수주확인',
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.original.orderConfirmed}
            onCheckedChange={(checked) =>
              toggleOrderConfirmed.mutate({ id: row.original.id, value: !!checked })
            }
          />
        </div>
      ),
    },
    {
      id: 'shipmentCompleted',
      header: '출하완료',
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.original.shipmentCompleted}
            onCheckedChange={(checked) =>
              toggleShipmentCompleted.mutate({ id: row.original.id, value: !!checked })
            }
            disabled={!row.original.orderConfirmed}
          />
        </div>
      ),
    },
    {
      accessorKey: 'deliveryNo',
      header: '납품번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.deliveryNo}</span>,
    },
    {
      id: 'orderNo',
      header: '수주번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.salesOrder?.orderNo || '-'}</span>,
    },
    {
      id: 'deliveryDate',
      header: '납품일',
      cell: ({ row }) => formatDate(row.original.deliveryDate),
    },
    {
      id: 'partner',
      header: '거래처',
      cell: ({ row }) => row.original.partner?.partnerName || '-',
    },
    {
      id: 'channel',
      header: '채널',
      cell: ({ row }) => {
        const ch = row.original.salesOrder?.salesChannel
        return ch === 'ONLINE' ? (
          <Badge variant="secondary" className="text-xs">온라인</Badge>
        ) : (
          <Badge variant="outline" className="text-xs">오프라인</Badge>
        )
      },
    },
    {
      id: 'amount',
      header: '출하금액',
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(
            row.original.details?.reduce((s: number, d: DeliveryDetailRow) => s + Number(d.amount), 0) || 0
          )}
        </span>
      ),
    },
    {
      id: 'actualRevenue',
      header: '실매출',
      cell: ({ row }) =>
        row.original.actualRevenue ? (
          <span className="text-status-success font-medium">{formatCurrency(Number(row.original.actualRevenue))}</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => <StatusBadge status={row.original.status} labels={STATUS_MAP} />,
    },
    {
      id: 'trackingStatus',
      header: '진행',
      cell: ({ row }) => {
        const d = row.original
        if (d.shipmentCompleted)
          return (
            <Badge variant="default" className="gap-1 text-xs">
              <CheckCircle className="h-3 w-3" /> 출하완료
            </Badge>
          )
        if (d.orderConfirmed)
          return (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Clock className="h-3 w-3" /> 출하예정
            </Badge>
          )
        return (
          <Badge variant="outline" className="gap-1 text-xs">
            <Package className="h-3 w-3" /> 수주대기
          </Badge>
        )
      },
    },
    {
      id: 'revenue',
      header: '매출입력',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setRevenueTarget(row.original)
            setRevenueDialogOpen(true)
          }}
        >
          매출
        </Button>
      ),
    },
    {
      id: 'attachments',
      header: '첨부',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => openAttachments(row.original)}
          title="첨부파일 관리"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  const exportColumns: ExportColumn[] = [
    { header: '수주확인', accessor: (r) => (r.orderConfirmed ? 'O' : '') },
    { header: '출하완료', accessor: (r) => (r.shipmentCompleted ? 'O' : '') },
    { header: '납품번호', accessor: 'deliveryNo' },
    { header: '수주번호', accessor: (r) => r.salesOrder?.orderNo || '' },
    { header: '납품일', accessor: (r) => formatDate(r.deliveryDate) },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '채널', accessor: (r) => r.salesOrder?.salesChannel || '' },
    {
      header: '출하금액',
      accessor: (r) =>
        formatCurrency(r.details?.reduce((s: number, d: DeliveryDetailRow) => s + Number(d.amount), 0) || 0),
    },
    { header: '실매출', accessor: (r) => (r.actualRevenue ? formatCurrency(r.actualRevenue) : '') },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status] || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = {
      fileName: '수주출하추적',
      title: '수주/출하 추적 현황',
      columns: exportColumns,
      data: deliveries,
    }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
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
    <div className="space-y-6">
      <PageHeader
        title="수주/출하 추적"
        description="수주 확인 및 출하 완료 상태를 관리합니다. 체크박스로 진행 상태를 업데이트하세요."
      />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => {
          setStartDate(s)
          setEndDate(e)
        }}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-4">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-[10px] sm:text-xs">전체</p>
          <p className="text-sm font-bold sm:text-lg">{summary.total}건</p>
        </div>
        <div className="bg-status-info-muted rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-[10px] sm:text-xs">수주확인</p>
          <p className="text-status-info text-sm font-bold sm:text-lg">{summary.confirmed}건</p>
        </div>
        <div className="bg-status-warning-muted rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-[10px] sm:text-xs">출하대기</p>
          <p className="text-status-warning text-sm font-bold sm:text-lg">{summary.pending}건</p>
        </div>
        <div className="bg-status-success-muted rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-[10px] sm:text-xs">출하완료</p>
          <p className="text-status-success text-sm font-bold sm:text-lg">{summary.shipped}건</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-[10px] sm:text-xs">총 출하금액</p>
          <p className="text-sm font-bold sm:text-lg">{formatCurrency(summary.totalAmount)}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="unconfirmed">수주대기</TabsTrigger>
          <TabsTrigger value="pending">출하예정</TabsTrigger>
          <TabsTrigger value="completed">출하완료</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="pt-4">
          <DataTable
            columns={columns}
            data={deliveries}
            searchColumn="deliveryNo"
            searchPlaceholder="납품번호로 검색..."
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            pageSize={50}
            onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
          />
        </TabsContent>
      </Tabs>

      {/* Revenue input dialog */}
      <Dialog open={revenueDialogOpen} onOpenChange={setRevenueDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>매출 정보 입력 - {revenueTarget?.deliveryNo}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRevenueSubmit} className="space-y-4">
            <p className="text-muted-foreground text-xs">
              온라인 판매가 변동으로 인한 실제 매출액을 별도로 기입할 수 있습니다.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">출하금액 (참고)</Label>
                <p className="text-sm font-medium">
                  {formatCurrency(
                    revenueTarget?.details?.reduce(
                      (s: number, d: DeliveryDetailRow) => s + Number(d.amount),
                      0
                    ) || 0
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
          </DialogHeader>
          <p className="text-muted-foreground text-xs">
            거래명세서, 인수증 등 출고 관련 서류를 업로드할 수 있습니다. (Excel, PDF, 이미지 등)
          </p>
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
                  <div
                    key={att.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
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

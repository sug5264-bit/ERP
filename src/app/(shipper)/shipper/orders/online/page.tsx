'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ExcelImportDialog } from '@/components/common/excel-import-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { SHIPPER_ORDER_STATUS_LABELS, SHIPPING_METHOD_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { exportToExcel, type ExportColumn } from '@/lib/export'
import type { TemplateColumn } from '@/lib/export'
import { toast } from 'sonner'
import {
  ShoppingCart,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Plus,
  Upload,
} from 'lucide-react'
import Link from 'next/link'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'

interface ShipperOrder {
  id: string
  orderNo: string
  orderDate: string
  recipientName: string
  recipientPhone?: string
  recipientAddress: string
  recipientZipCode?: string
  senderName?: string
  senderPhone?: string
  senderAddress?: string
  itemName: string
  quantity: number
  weight?: number
  shippingMethod: string
  specialNote?: string
  status: string
  trackingNo?: string
  carrier?: string
  deliveredAt?: string
}

const templateColumns: TemplateColumn[] = [
  { header: '수취인명*', key: 'recipientName', required: true, example: '홍길동' },
  { header: '수취인 연락처', key: 'recipientPhone', example: '010-1234-5678' },
  { header: '수취인 우편번호', key: 'recipientZipCode', example: '06234' },
  { header: '수취인 주소*', key: 'recipientAddress', required: true, example: '서울시 강남구 역삼동 123' },
  { header: '상품명*', key: 'itemName', required: true, example: '건강식품 세트' },
  { header: '수량', key: 'quantity', example: '1' },
  { header: '중량(kg)', key: 'weight', example: '2.5' },
  { header: '배송방법', key: 'shippingMethod', example: 'NORMAL' },
  { header: '특이사항', key: 'specialNote', example: '부재시 경비실' },
  { header: '발송인명', key: 'senderName', example: '(주)웰그린' },
  { header: '발송인 연락처', key: 'senderPhone', example: '02-1234-5678' },
  { header: '발송인 주소', key: 'senderAddress', example: '서울시 서초구' },
]

const keyMap: Record<string, string> = {
  수취인명: 'recipientName',
  '수취인 연락처': 'recipientPhone',
  '수취인 우편번호': 'recipientZipCode',
  '수취인 주소': 'recipientAddress',
  상품명: 'itemName',
  수량: 'quantity',
  '중량(kg)': 'weight',
  배송방법: 'shippingMethod',
  특이사항: 'specialNote',
  발송인명: 'senderName',
  '발송인 연락처': 'senderPhone',
  '발송인 주소': 'senderAddress',
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default function ShipperOnlineOrdersPage() {
  const router = useRouter()
  const now = new Date()
  const [kpiYear, setKpiYear] = useState(now.getFullYear())
  const [kpiMonth, setKpiMonth] = useState(now.getMonth() + 1)
  const { start: startDate, end: endDate } = useMemo(() => getMonthRange(kpiYear, kpiMonth), [kpiYear, kpiMonth])

  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [excelDialogOpen, setExcelDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [form, setForm] = useState({
    senderName: '',
    senderPhone: '',
    senderAddress: '',
    recipientName: '',
    recipientPhone: '',
    recipientZipCode: '',
    recipientAddress: '',
    itemName: '',
    quantity: 1,
    weight: '',
    shippingMethod: 'NORMAL',
    specialNote: '',
  })

  const updateField = (field: string, value: string | number) => setForm((prev) => ({ ...prev, [field]: value }))

  const prevMonth = useCallback(() => {
    if (kpiMonth === 1) {
      setKpiYear(kpiYear - 1)
      setKpiMonth(12)
    } else setKpiMonth(kpiMonth - 1)
  }, [kpiYear, kpiMonth])

  const nextMonth = useCallback(() => {
    if (kpiMonth === 12) {
      setKpiYear(kpiYear + 1)
      setKpiMonth(1)
    } else setKpiMonth(kpiMonth + 1)
  }, [kpiYear, kpiMonth])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shipper-orders-online', startDate, endDate],
    queryFn: () =>
      api.get(`/shipper/orders?startDate=${startDate}&endDate=${endDate}`) as Promise<{ data: ShipperOrder[] }>,
  })

  const allOrders = useMemo(() => data?.data || [], [data])

  const stats = useMemo(() => {
    const total = allOrders.length
    const received = allOrders.filter((o) => o.status === 'RECEIVED').length
    const processing = allOrders.filter((o) => o.status === 'PROCESSING').length
    const shipped = allOrders.filter((o) => ['SHIPPED', 'IN_TRANSIT'].includes(o.status)).length
    const delivered = allOrders.filter((o) => o.status === 'DELIVERED').length
    const fulfillmentRate = total > 0 ? Math.round((delivered / total) * 100) : 0
    return { total, received, processing, shipped, delivered, fulfillmentRate }
  }, [allOrders])

  const filteredOrders = useMemo(() => {
    if (activeStep === null) return allOrders
    const statusMap: Record<number, string[]> = {
      0: [], // all
      1: ['RECEIVED', 'PROCESSING'],
      2: ['SHIPPED', 'IN_TRANSIT'],
      3: ['DELIVERED'],
    }
    const statuses = statusMap[activeStep]
    if (!statuses || statuses.length === 0) return allOrders
    return allOrders.filter((o) => statuses.includes(o.status))
  }, [allOrders, activeStep])

  const handlePipelineClick = useCallback(
    (idx: number) => {
      setActiveStep(activeStep === idx ? null : idx)
    },
    [activeStep]
  )

  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(filteredOrders.map((o) => o.id)))
    }
  }, [selectedOrders.size, filteredOrders])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.recipientName || !form.recipientAddress || !form.itemName) {
      toast.error('필수 항목을 입력해주세요')
      return
    }
    setIsSubmitting(true)
    try {
      await api.post('/shipper/orders', {
        ...form,
        quantity: Number(form.quantity),
        weight: form.weight ? Number(form.weight) : null,
      })
      toast.success('주문이 등록되었습니다')
      setCreateOpen(false)
      setForm({
        senderName: '',
        senderPhone: '',
        senderAddress: '',
        recipientName: '',
        recipientPhone: '',
        recipientZipCode: '',
        recipientAddress: '',
        itemName: '',
        quantity: 1,
        weight: '',
        shippingMethod: 'NORMAL',
        specialNote: '',
      })
      refetch()
    } catch {
      toast.error('주문 등록에 실패했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExcelExport = useCallback(() => {
    const target = selectedOrders.size > 0 ? filteredOrders.filter((o) => selectedOrders.has(o.id)) : filteredOrders
    if (target.length === 0) return

    const exportColumns: ExportColumn[] = [
      { header: '주문번호', accessor: 'orderNo' },
      { header: '주문일', accessor: (r) => formatDate(r.orderDate) },
      { header: '수취인', accessor: 'recipientName' },
      { header: '상품명', accessor: 'itemName' },
      { header: '수량', accessor: 'quantity' },
      { header: '배송방법', accessor: (r) => SHIPPING_METHOD_LABELS[r.shippingMethod as string] || r.shippingMethod },
      { header: '상태', accessor: (r) => SHIPPER_ORDER_STATUS_LABELS[r.status as string] || r.status },
      { header: '운송장번호', accessor: (r) => r.trackingNo || '' },
    ]

    exportToExcel({
      fileName: `온라인주문_${startDate}_${endDate}`,
      sheetName: '주문목록',
      columns: exportColumns,
      data: target,
    })
    toast.success(`${target.length}건 엑셀 다운로드 완료`)
  }, [filteredOrders, selectedOrders, startDate, endDate])

  const pipelineSteps = [
    { label: '전체 주문', count: stats.total, icon: ShoppingCart, color: 'blue' as const },
    { label: '처리중', count: stats.received + stats.processing, icon: Clock, color: 'amber' as const },
    { label: '배송중', count: stats.shipped, icon: Package, color: 'violet' as const },
    { label: '배송완료', count: stats.delivered, icon: CheckCircle2, color: 'emerald' as const },
  ]

  const colorMap = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-200 dark:ring-blue-800',
      activeBg: 'bg-blue-100 dark:bg-blue-900',
      activeRing: 'ring-blue-500 dark:ring-blue-400',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-200 dark:ring-amber-800',
      activeBg: 'bg-amber-100 dark:bg-amber-900',
      activeRing: 'ring-amber-500 dark:ring-amber-400',
    },
    violet: {
      bg: 'bg-violet-50 dark:bg-violet-950',
      text: 'text-violet-600 dark:text-violet-400',
      ring: 'ring-violet-200 dark:ring-violet-800',
      activeBg: 'bg-violet-100 dark:bg-violet-900',
      activeRing: 'ring-violet-500 dark:ring-violet-400',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-200 dark:ring-emerald-800',
      activeBg: 'bg-emerald-100 dark:bg-emerald-900',
      activeRing: 'ring-emerald-500 dark:ring-emerald-400',
    },
  }

  return (
    <ShipperLayoutShell>
      <div className="space-y-6">
        <PageHeader
          title="온라인 주문관리"
          description="온라인 주문 등록부터 배송까지 통합 관리합니다"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setExcelDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> 엑셀 업로드
              </Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> 주문등록
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>온라인 주문등록</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm">발송인 정보</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">이름</Label>
                          <Input
                            value={form.senderName}
                            onChange={(e) => updateField('senderName', e.target.value)}
                            placeholder="발송인명"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">전화번호</Label>
                          <Input
                            value={form.senderPhone}
                            onChange={(e) => updateField('senderPhone', e.target.value)}
                            placeholder="010-0000-0000"
                            className="mt-1"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">주소</Label>
                          <Input
                            value={form.senderAddress}
                            onChange={(e) => updateField('senderAddress', e.target.value)}
                            placeholder="발송인 주소"
                            className="mt-1"
                          />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm">
                          수취인 정보 <span className="text-destructive">*</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">이름 *</Label>
                          <Input
                            required
                            value={form.recipientName}
                            onChange={(e) => updateField('recipientName', e.target.value)}
                            placeholder="수취인명"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">전화번호</Label>
                          <Input
                            value={form.recipientPhone}
                            onChange={(e) => updateField('recipientPhone', e.target.value)}
                            placeholder="010-0000-0000"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">우편번호</Label>
                          <Input
                            value={form.recipientZipCode}
                            onChange={(e) => updateField('recipientZipCode', e.target.value)}
                            placeholder="12345"
                            className="mt-1"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <Label className="text-xs">주소 *</Label>
                          <Input
                            required
                            value={form.recipientAddress}
                            onChange={(e) => updateField('recipientAddress', e.target.value)}
                            placeholder="수취인 주소"
                            className="mt-1"
                          />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm">상품 · 배송 정보</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-4">
                        <div className="sm:col-span-2">
                          <Label className="text-xs">상품명 *</Label>
                          <Input
                            required
                            value={form.itemName}
                            onChange={(e) => updateField('itemName', e.target.value)}
                            placeholder="상품명"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">수량</Label>
                          <Input
                            type="number"
                            min={1}
                            value={form.quantity}
                            onChange={(e) => updateField('quantity', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">중량(kg)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={form.weight}
                            onChange={(e) => updateField('weight', e.target.value)}
                            placeholder="0.0"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">배송방법</Label>
                          <Select value={form.shippingMethod} onValueChange={(v) => updateField('shippingMethod', v)}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(SHIPPING_METHOD_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>
                                  {v}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-3">
                          <Label className="text-xs">특이사항</Label>
                          <Textarea
                            value={form.specialNote}
                            onChange={(e) => updateField('specialNote', e.target.value)}
                            placeholder="배송 요청사항"
                            className="mt-1"
                            rows={2}
                          />
                        </div>
                      </CardContent>
                    </Card>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                        취소
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 등록 중...
                          </>
                        ) : (
                          '주문등록'
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          }
        />

        {/* Month selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border px-2 py-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">
              {kpiYear}년 {kpiMonth}월
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Process Pipeline Flow */}
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-xs font-medium">처리 현황</span>
                {activeStep !== null && (
                  <button
                    onClick={() => setActiveStep(null)}
                    className="text-muted-foreground hover:text-foreground ml-1 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors"
                  >
                    <X className="h-3 w-3" /> 필터 해제
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">이행률</span>
                <Badge
                  variant={
                    stats.fulfillmentRate >= 80 ? 'default' : stats.fulfillmentRate >= 50 ? 'secondary' : 'outline'
                  }
                  className="text-xs tabular-nums"
                >
                  {isLoading ? '...' : `${stats.fulfillmentRate}%`}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto sm:gap-0">
              {pipelineSteps.map((step, idx) => {
                const colors = colorMap[step.color]
                const Icon = step.icon
                const isActive = activeStep === idx
                return (
                  <div key={step.label} className="flex min-w-0 flex-1 items-center">
                    <button
                      type="button"
                      onClick={() => handlePipelineClick(idx)}
                      className={`flex min-w-[72px] flex-1 flex-col items-center gap-1.5 rounded-lg py-2 transition-all sm:min-w-[96px] ${
                        isActive ? 'bg-muted/60 scale-105 shadow-sm' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 transition-all sm:h-10 sm:w-10 ${
                          isActive
                            ? `${colors.activeBg} ${colors.activeRing} scale-110 shadow-md`
                            : `${colors.bg} ${colors.ring}`
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className={`h-4 w-4 animate-spin ${colors.text}`} />
                        ) : (
                          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.text}`} />
                        )}
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-[10px] leading-tight font-medium sm:text-xs ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {step.label}
                        </p>
                        <p
                          className={`mt-0.5 text-sm font-bold tabular-nums sm:text-base ${isActive ? 'text-foreground' : ''}`}
                        >
                          {isLoading ? '-' : step.count}
                          <span className="text-muted-foreground text-[10px] font-normal">건</span>
                        </p>
                      </div>
                    </button>
                    {idx < pipelineSteps.length - 1 && (
                      <ArrowRight className="text-muted-foreground/40 mx-0.5 h-4 w-4 shrink-0 sm:mx-1" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4">
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: isLoading ? '0%' : `${stats.fulfillmentRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: '전체 주문',
              count: stats.total,
              step: 0,
              color: 'blue',
              icon: ShoppingCart,
              sub: `접수 ${stats.received}건`,
            },
            {
              label: '처리중',
              count: stats.received + stats.processing,
              step: 1,
              color: 'amber',
              icon: Clock,
              sub: `처리 ${stats.processing}건`,
            },
            { label: '배송중', count: stats.shipped, step: 2, color: 'violet', icon: Package, sub: `출고 포함` },
            {
              label: '배송완료',
              count: stats.delivered,
              step: 3,
              color: 'emerald',
              icon: CheckCircle2,
              sub: `전체 ${stats.total}건 중`,
            },
          ].map((card) => (
            <Card
              key={card.label}
              className={`group cursor-pointer gap-0 border-l-4 border-l-${card.color}-500 py-4 shadow-sm transition-all hover:shadow-md ${activeStep === card.step ? `ring-2 ring-${card.color}-500` : ''}`}
              onClick={() => handlePipelineClick(card.step)}
            >
              <CardContent className="flex items-center gap-3 px-4 py-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-${card.color}-50 transition-transform group-hover:scale-110 dark:bg-${card.color}-950`}
                >
                  <card.icon className={`h-5 w-5 text-${card.color}-600 dark:text-${card.color}-400`} />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs font-medium">{card.label}</p>
                  {isLoading ? (
                    <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold tabular-nums">{card.count}</span>
                      <span className="text-muted-foreground text-xs">건</span>
                    </div>
                  )}
                  <p className="text-muted-foreground mt-0.5 text-[10px]">{card.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order List */}
        <Card className="overflow-hidden border shadow-sm">
          <CardHeader className="border-b px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">주문 목록</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {filteredOrders.length}건
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {selectedOrders.size > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {selectedOrders.size}건 선택
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={handleExcelExport}>
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                  {selectedOrders.size > 0 ? '선택 엑셀' : '전체 엑셀'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                해당 기간의 주문 데이터가 없습니다
              </div>
            ) : (
              <div className="divide-y">
                <div className="bg-muted/30 flex items-center gap-3 px-4 py-2 sm:px-6">
                  <Checkbox
                    checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-muted-foreground text-xs font-medium">전체 선택</span>
                </div>
                {filteredOrders.map((order) => {
                  const statusLabel = SHIPPER_ORDER_STATUS_LABELS[order.status] || order.status
                  return (
                    <div
                      key={order.id}
                      className="hover:bg-muted/20 flex items-center gap-3 px-4 py-3 transition-colors sm:px-6"
                    >
                      <Checkbox
                        checked={selectedOrders.has(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                      />
                      <Link
                        href={`/shipper/orders/${order.id}`}
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
                      >
                        <span className="font-mono text-sm font-medium text-blue-600 hover:underline">
                          {order.orderNo || order.id.slice(0, 8)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {statusLabel}
                        </Badge>
                        <span className="text-muted-foreground text-xs">{order.recipientName}</span>
                        <span className="text-muted-foreground text-xs">{order.itemName}</span>
                        <span className="text-muted-foreground text-xs">{formatDate(order.orderDate)}</span>
                        {order.trackingNo && (
                          <span className="font-mono text-xs text-green-600">{order.trackingNo}</span>
                        )}
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Excel Import Dialog */}
        <ExcelImportDialog
          open={excelDialogOpen}
          onOpenChange={setExcelDialogOpen}
          title="온라인 주문 대량 업로드"
          apiEndpoint="/shipper/orders/import"
          templateColumns={templateColumns}
          templateFileName="온라인주문_업로드_템플릿"
          keyMap={keyMap}
          onSuccess={() => refetch()}
        />
      </div>
    </ShipperLayoutShell>
  )
}

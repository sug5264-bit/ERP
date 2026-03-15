'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Search,
  Package,
  ShoppingCart,
  CheckCircle2,
  Clock,
  TrendingUp,
  Loader2,
  Truck,
  ArrowRight,
} from 'lucide-react'

interface Partner {
  id: string
  partnerCode: string
  partnerName: string
  bizNo?: string
}

interface Item {
  id: string
  itemCode: string
  itemName: string
  specification?: string
  unit: string
  standardPrice: number
  barcode?: string
}

interface OrderDetail {
  itemId: string
  itemName?: string
  quantity: number
  unitPrice: number
  amount: number
}

interface SalesOrder {
  id: string
  orderNo: string
  orderDate: string
  status: string
  salesChannel: string
  totalAmount: number
  totalSupply: number
  totalTax: number
  description?: string
  partner?: Partner
  details?: {
    id: string
    itemId: string
    quantity: number
    unitPrice: number
    totalAmount: number
    deliveredQty: number
    remainingQty: number
    item?: Item
  }[]
}

function getLocalDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ORDERED: { label: '발주완료', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  IN_PROGRESS: { label: '진행중', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED: { label: '완료', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  CANCELLED: { label: '취소', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

export default function OfflineOrdersPage() {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Create form state
  const [orderDate, setOrderDate] = useState(getLocalDateString())
  const [partnerId, setPartnerId] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [description, setDescription] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([
    { itemId: '', itemName: '', quantity: 1, unitPrice: 0, amount: 0 },
  ])

  // Delivery form
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false)
  const [deliveryOrderId, setDeliveryOrderId] = useState('')
  const [deliveryFormDate, setDeliveryFormDate] = useState(getLocalDateString())

  // Data queries
  const dateParams = useMemo(() => {
    let params = '&salesChannel=OFFLINE'
    if (startDate) params += `&startDate=${startDate}`
    if (endDate) params += `&endDate=${endDate}`
    if (searchKeyword) params += `&search=${encodeURIComponent(searchKeyword)}`
    return params
  }, [startDate, endDate, searchKeyword])

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['sales-orders-offline', startDate, endDate, searchKeyword],
    queryFn: () =>
      api.get(`/sales/orders?pageSize=200${dateParams}`) as Promise<{ data: SalesOrder[] }>,
  })
  const orders = ordersData?.data || []

  const { data: partnersData } = useQuery({
    queryKey: ['partners-list'],
    queryFn: () => api.get('/partners?pageSize=500&partnerType=CUSTOMER') as Promise<{ data: Partner[] }>,
    staleTime: 5 * 60 * 1000,
  })
  const partners = partnersData?.data || []

  const { data: itemsData } = useQuery({
    queryKey: ['items-list'],
    queryFn: () => api.get('/inventory/items?pageSize=500&isActive=true') as Promise<{ data: Item[] }>,
    staleTime: 5 * 60 * 1000,
  })
  const items = itemsData?.data || []

  // Stats
  const stats = useMemo(() => {
    const total = orders.length
    const ordered = orders.filter((o) => o.status === 'ORDERED').length
    const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS').length
    const completed = orders.filter((o) => o.status === 'COMPLETED').length
    const totalAmount = orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0)
    return { total, ordered, inProgress, completed, totalAmount }
  }, [orders])

  // Create order mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const validDetails = orderDetails.filter((d) => (d.itemId || d.itemName) && d.quantity > 0)
      if (validDetails.length === 0) throw new Error('최소 1개 이상의 품목을 입력하세요')
      if (!orderDate) throw new Error('발주일을 입력하세요')

      return api.post('/sales/orders', {
        orderDate,
        partnerId: partnerId || undefined,
        partnerName: !partnerId ? partnerName || undefined : undefined,
        salesChannel: 'OFFLINE',
        deliveryDate: deliveryDate || undefined,
        description: description || undefined,
        vatIncluded: true,
        details: validDetails.map((d) => ({
          itemId: d.itemId || undefined,
          itemName: d.itemName || undefined,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
        })),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-offline'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] })
      resetForm()
      setCreateOpen(false)
      toast.success('오프라인 발주가 등록되었습니다.')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '발주 등록에 실패했습니다.')
    },
  })

  // Create delivery mutation (출고 처리 - 재고 차감 + 매출 반영)
  const deliveryMutation = useMutation({
    mutationFn: async () => {
      const order = orders.find((o) => o.id === deliveryOrderId)
      if (!order) throw new Error('발주를 찾을 수 없습니다.')

      const details = order.details
        ?.filter((d) => Number(d.remainingQty) > 0)
        .map((d) => ({
          itemId: d.itemId,
          quantity: Number(d.remainingQty),
          unitPrice: Number(d.unitPrice),
        }))

      if (!details || details.length === 0) throw new Error('출고할 잔여 수량이 없습니다.')

      return api.post('/sales/deliveries', {
        deliveryDate: deliveryFormDate,
        salesOrderId: deliveryOrderId,
        details,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-offline'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] })
      queryClient.invalidateQueries({ queryKey: ['stock-balance'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movement'] })
      setDeliveryDialogOpen(false)
      setDeliveryOrderId('')
      toast.success('출고 처리가 완료되었습니다. 재고가 차감되었습니다.')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '출고 처리에 실패했습니다.')
    },
  })

  // Delete order
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-offline'] })
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] })
      setDeleteTarget(null)
      toast.success('발주가 삭제되었습니다.')
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  })

  const resetForm = () => {
    setOrderDate(getLocalDateString())
    setPartnerId('')
    setPartnerName('')
    setDescription('')
    setDeliveryDate('')
    setOrderDetails([{ itemId: '', itemName: '', quantity: 1, unitPrice: 0, amount: 0 }])
  }

  const updateDetail = (idx: number, field: string, value: string | number) => {
    setOrderDetails((prev) => {
      const updated = [...prev]
      const detail = { ...updated[idx], [field]: value }
      if (field === 'itemId' && typeof value === 'string') {
        const item = items.find((i) => i.id === value)
        if (item) {
          detail.itemName = item.itemName
          detail.unitPrice = Number(item.standardPrice)
        }
      }
      detail.amount = Math.round(detail.quantity * detail.unitPrice)
      updated[idx] = detail
      return updated
    })
  }

  const addDetail = () => {
    setOrderDetails((prev) => [...prev, { itemId: '', itemName: '', quantity: 1, unitPrice: 0, amount: 0 }])
  }

  const removeDetail = (idx: number) => {
    setOrderDetails((prev) => prev.filter((_, i) => i !== idx))
  }

  const totalAmount = orderDetails.reduce((s, d) => s + d.amount, 0)

  const openDeliveryDialog = (orderId: string) => {
    setDeliveryOrderId(orderId)
    setDeliveryFormDate(getLocalDateString())
    setDeliveryDialogOpen(true)
  }

  const pipelineSteps = [
    { label: '전체 발주', count: stats.total, icon: ShoppingCart, color: 'blue' },
    { label: '진행중', count: stats.inProgress, icon: Clock, color: 'amber' },
    { label: '출고 완료', count: stats.completed, icon: CheckCircle2, color: 'emerald' },
  ]

  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800' },
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="발주/출고관리(오프라인)"
        description="오프라인 거래처 발주 등록 및 출고/재고 연동 관리"
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> 발주 등록
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>오프라인 발주 등록</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">발주일 *</label>
                  <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">납기일</label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">거래처</label>
                <Select value={partnerId} onValueChange={(v) => { setPartnerId(v); setPartnerName('') }}>
                  <SelectTrigger>
                    <SelectValue placeholder="거래처 선택 (미선택 시 직접 입력)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">직접 입력</SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.partnerName} ({p.partnerCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!partnerId || partnerId === 'none') && (
                  <Input
                    className="mt-1"
                    placeholder="거래처명 직접 입력 (자동 생성됨)"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">비고</label>
                <Textarea
                  placeholder="비고 사항..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Order details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">품목 목록 *</label>
                  <Button type="button" variant="outline" size="sm" onClick={addDetail}>
                    <Plus className="mr-1 h-3 w-3" /> 품목 추가
                  </Button>
                </div>
                <div className="space-y-2">
                  {orderDetails.map((detail, idx) => (
                    <div key={idx} className="flex items-end gap-2 rounded-md border p-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <label className="text-muted-foreground text-[10px]">품목</label>
                        <Select
                          value={detail.itemId}
                          onValueChange={(v) => updateDetail(idx, 'itemId', v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="품목 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.itemName} ({item.itemCode})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-20 space-y-1">
                        <label className="text-muted-foreground text-[10px]">수량</label>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 text-xs"
                          value={detail.quantity}
                          onChange={(e) => updateDetail(idx, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <label className="text-muted-foreground text-[10px]">단가</label>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 text-xs"
                          value={detail.unitPrice}
                          onChange={(e) => updateDetail(idx, 'unitPrice', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <label className="text-muted-foreground text-[10px]">금액</label>
                        <div className="flex h-8 items-center text-xs font-medium tabular-nums">
                          {detail.amount.toLocaleString()}원
                        </div>
                      </div>
                      {orderDetails.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                          onClick={() => removeDetail(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm font-bold">
                  합계: {totalAmount.toLocaleString()}원
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  size="sm"
                >
                  {createMutation.isPending ? '등록 중...' : '발주 등록'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }}
        />

        <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="발주번호, 거래처 검색..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
      </div>

      {/* Pipeline */}
      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium">처리 현황</span>
            </div>
            <div className="text-sm font-bold tabular-nums">
              총 매출 {stats.totalAmount.toLocaleString()}원
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto sm:gap-0">
            {pipelineSteps.map((step, idx) => {
              const colors = colorMap[step.color]
              const Icon = step.icon
              return (
                <div key={step.label} className="flex min-w-0 flex-1 items-center">
                  <div className="flex min-w-[72px] flex-1 flex-col items-center gap-1.5 rounded-lg py-2 sm:min-w-[96px]">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 sm:h-10 sm:w-10 ${colors.bg} ${colors.ring}`}>
                      <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.text}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-[10px] font-medium leading-tight sm:text-xs">{step.label}</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums sm:text-base">
                        {isLoading ? '-' : step.count}
                        <span className="text-muted-foreground text-[10px] font-normal">건</span>
                      </p>
                    </div>
                  </div>
                  {idx < pipelineSteps.length - 1 && (
                    <ArrowRight className="text-muted-foreground/40 mx-0.5 h-4 w-4 shrink-0 sm:mx-1" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="gap-0 border-l-4 border-l-blue-500 py-4 shadow-sm">
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-muted-foreground text-xs">전체 발주</p>
              <span className="text-lg font-bold tabular-nums">{stats.total}</span>
              <span className="text-muted-foreground text-xs"> 건</span>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 border-l-4 border-l-amber-500 py-4 shadow-sm">
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <Clock className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-muted-foreground text-xs">대기/진행</p>
              <span className="text-lg font-bold tabular-nums">{stats.ordered + stats.inProgress}</span>
              <span className="text-muted-foreground text-xs"> 건</span>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 border-l-4 border-l-emerald-500 py-4 shadow-sm">
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-muted-foreground text-xs">출고 완료</p>
              <span className="text-lg font-bold tabular-nums">{stats.completed}</span>
              <span className="text-muted-foreground text-xs"> 건</span>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 border-l-4 border-l-violet-500 py-4 shadow-sm">
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <TrendingUp className="h-5 w-5 text-violet-600" />
            <div>
              <p className="text-muted-foreground text-xs">총 매출액</p>
              <span className="text-lg font-bold tabular-nums">{(stats.totalAmount / 10000).toFixed(0)}</span>
              <span className="text-muted-foreground text-xs"> 만원</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders list */}
      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4" />
            오프라인 발주 목록
            <Badge variant="secondary" className="text-[10px]">{orders.length}건</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading && <div className="text-muted-foreground py-12 text-center text-sm">불러오는 중...</div>}
          {!isLoading && orders.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center py-12 text-sm">
              <Package className="mb-2 h-8 w-8" />
              <p>등록된 오프라인 발주가 없습니다.</p>
            </div>
          )}
          <div className="space-y-2">
            {orders.map((order) => {
              const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.ORDERED
              const hasRemaining = order.details?.some((d) => Number(d.remainingQty) > 0)
              return (
                <div key={order.id} className="rounded-lg border p-3 transition-shadow hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">{order.orderNo}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {order.partner && (
                          <Badge variant="outline" className="text-[10px]">
                            {order.partner.partnerName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-muted-foreground">발주일: {formatDate(order.orderDate)}</span>
                        <span className="font-medium tabular-nums">
                          {Number(order.totalAmount).toLocaleString()}원
                        </span>
                        {order.details && (
                          <span className="text-muted-foreground">
                            품목 {order.details.length}건
                          </span>
                        )}
                      </div>
                      {order.description && (
                        <p className="text-muted-foreground mt-1 text-xs">{order.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {hasRemaining && order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => openDeliveryDialog(order.id)}
                        >
                          <Truck className="h-3 w-3" /> 출고
                        </Button>
                      )}
                      {order.status === 'ORDERED' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-7 w-7"
                          onClick={() => setDeleteTarget(order.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>출고 처리</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">
              잔여 수량 전체를 출고합니다. 재고가 자동으로 차감되며 매출에 반영됩니다.
            </p>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">출고일 *</label>
              <Input type="date" value={deliveryFormDate} onChange={(e) => setDeliveryFormDate(e.target.value)} />
            </div>
            {deliveryOrderId && (() => {
              const order = orders.find((o) => o.id === deliveryOrderId)
              if (!order?.details) return null
              const remaining = order.details.filter((d) => Number(d.remainingQty) > 0)
              return (
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs font-medium">출고 품목</label>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
                    {remaining.map((d) => (
                      <div key={d.id} className="flex justify-between text-xs">
                        <span>{d.item?.itemName || d.itemId}</span>
                        <span className="tabular-nums">{Number(d.remainingQty)}개</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeliveryDialogOpen(false)}>취소</Button>
              <Button
                size="sm"
                onClick={() => deliveryMutation.mutate()}
                disabled={deliveryMutation.isPending}
              >
                <Truck className="mr-1 h-3.5 w-3.5" />
                {deliveryMutation.isPending ? '처리 중...' : '출고 처리'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="발주 삭제"
        description="이 발주를 삭제하시겠습니까?"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }}
        variant="destructive"
      />
    </div>
  )
}

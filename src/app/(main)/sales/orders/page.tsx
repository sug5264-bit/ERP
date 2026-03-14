'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OrdersPanel } from '@/components/sales/orders-panel'
import { DeliveriesPanel } from '@/components/sales/deliveries-panel'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import {
  ShoppingCart,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Loader2,
} from 'lucide-react'

interface SalesOrder {
  id: string
  status: string
  orderDate: string
  salesChannel?: string
}

interface DeliveryRow {
  id: string
  status: string
  deliveryDate: string
}

export default function OrderShipmentPage() {
  const [mainTab, setMainTab] = useState<string>('orders')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Build query params for date filtering
  const dateParams = useMemo(() => {
    let params = ''
    if (startDate) params += `&startDate=${startDate}`
    if (endDate) params += `&endDate=${endDate}`
    return params
  }, [startDate, endDate])

  const channelParam = channelFilter && channelFilter !== 'all' ? `&salesChannel=${channelFilter}` : ''

  // Fetch summary data for KPI cards
  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-summary', channelFilter, startDate, endDate],
    queryFn: () =>
      api.get(`/sales/orders?pageSize=200${channelParam}${dateParams}`) as Promise<{ data: SalesOrder[] }>,
    staleTime: 2 * 60 * 1000,
  })
  const { data: deliveriesData } = useQuery({
    queryKey: ['sales-deliveries-summary', channelFilter, startDate, endDate],
    queryFn: () =>
      api.get(`/sales/deliveries?pageSize=200${channelParam}${dateParams}`) as Promise<{
        data: DeliveryRow[]
      }>,
    staleTime: 2 * 60 * 1000,
  })

  const stats = useMemo(() => {
    const allOrders = ordersData?.data || []
    const allDeliveries = deliveriesData?.data || []

    const totalOrders = allOrders.length
    const ordersInProgress = allOrders.filter((o) => o.status === 'IN_PROGRESS').length
    const ordersCompleted = allOrders.filter((o) => o.status === 'COMPLETED').length

    const totalDeliveries = allDeliveries.length
    const deliveriesPreparing = allDeliveries.filter((d) => d.status === 'PREPARING').length
    const deliveriesShipped = allDeliveries.filter((d) => d.status === 'SHIPPED').length
    const deliveriesCompleted = allDeliveries.filter((d) => d.status === 'DELIVERED').length

    const fulfillmentRate =
      totalOrders > 0 ? Math.round((deliveriesCompleted / totalOrders) * 100) : 0

    return {
      totalOrders,
      ordersInProgress,
      ordersCompleted,
      totalDeliveries,
      deliveriesPreparing,
      deliveriesShipped,
      deliveriesCompleted,
      fulfillmentRate,
    }
  }, [ordersData, deliveriesData])

  const isLoading = !ordersData && !deliveriesData

  const pipelineSteps = [
    { label: '수주 접수', count: stats.totalOrders, icon: ShoppingCart, color: 'blue' as const },
    { label: '진행중', count: stats.ordersInProgress, icon: Clock, color: 'amber' as const },
    { label: '출하 준비', count: stats.deliveriesPreparing, icon: Package, color: 'violet' as const },
    { label: '배송중', count: stats.deliveriesShipped, icon: Truck, color: 'sky' as const },
    { label: '납품 완료', count: stats.deliveriesCompleted, icon: CheckCircle2, color: 'emerald' as const },
  ]

  const colorMap = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-200 dark:ring-blue-800',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-200 dark:ring-amber-800',
    },
    violet: {
      bg: 'bg-violet-50 dark:bg-violet-950',
      text: 'text-violet-600 dark:text-violet-400',
      ring: 'ring-violet-200 dark:ring-violet-800',
    },
    sky: {
      bg: 'bg-sky-50 dark:bg-sky-950',
      text: 'text-sky-600 dark:text-sky-400',
      ring: 'ring-sky-200 dark:ring-sky-800',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-200 dark:ring-emerald-800',
    },
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="수주/출하 통합관리"
        description="수주 등록부터 출하/납품까지 통합 관리합니다"
      />

      {/* Filter bar: online/offline + date range */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="전체 구분" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="ONLINE">온라인</SelectItem>
            <SelectItem value="OFFLINE">오프라인</SelectItem>
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
      </div>

      {/* Process Pipeline Flow */}
      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium">처리 현황</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">이행률</span>
              <Badge
                variant={stats.fulfillmentRate >= 80 ? 'default' : stats.fulfillmentRate >= 50 ? 'secondary' : 'outline'}
                className="tabular-nums text-xs"
              >
                {isLoading ? '...' : `${stats.fulfillmentRate}%`}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto sm:gap-0">
            {pipelineSteps.map((step, idx) => {
              const colors = colorMap[step.color]
              const Icon = step.icon
              return (
                <div key={step.label} className="flex min-w-0 flex-1 items-center">
                  <div className="flex min-w-[72px] flex-1 flex-col items-center gap-1.5 sm:min-w-[96px]">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 sm:h-10 sm:w-10 ${colors.bg} ${colors.ring}`}
                    >
                      {isLoading ? (
                        <Loader2 className={`h-4 w-4 animate-spin ${colors.text}`} />
                      ) : (
                        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.text}`} />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-[10px] font-medium leading-tight sm:text-xs">
                        {step.label}
                      </p>
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
        <Card
          className="group cursor-pointer gap-0 border-l-4 border-l-blue-500 py-4 shadow-sm transition-all hover:shadow-md"
          onClick={() => setMainTab('orders')}
        >
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 transition-transform group-hover:scale-110 dark:bg-blue-950">
              <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">총 수주</p>
              {isLoading ? (
                <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums">{stats.totalOrders}</span>
                  <span className="text-muted-foreground text-xs">건</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer gap-0 border-l-4 border-l-amber-500 py-4 shadow-sm transition-all hover:shadow-md"
          onClick={() => setMainTab('orders')}
        >
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 transition-transform group-hover:scale-110 dark:bg-amber-950">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">진행중 수주</p>
              {isLoading ? (
                <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums">{stats.ordersInProgress}</span>
                  <span className="text-muted-foreground text-xs">건</span>
                </div>
              )}
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                완료 {stats.ordersCompleted}건
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer gap-0 border-l-4 border-l-violet-500 py-4 shadow-sm transition-all hover:shadow-md"
          onClick={() => setMainTab('deliveries')}
        >
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 transition-transform group-hover:scale-110 dark:bg-violet-950">
              <Package className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">출하 대기</p>
              {isLoading ? (
                <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums">
                    {stats.deliveriesPreparing}
                  </span>
                  <span className="text-muted-foreground text-xs">건</span>
                </div>
              )}
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                배송중 {stats.deliveriesShipped}건
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="group cursor-pointer gap-0 border-l-4 border-l-emerald-500 py-4 shadow-sm transition-all hover:shadow-md"
          onClick={() => setMainTab('deliveries')}
        >
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 transition-transform group-hover:scale-110 dark:bg-emerald-950">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">납품 완료</p>
              {isLoading ? (
                <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums">
                    {stats.deliveriesCompleted}
                  </span>
                  <span className="text-muted-foreground text-xs">건</span>
                </div>
              )}
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                전체 {stats.totalDeliveries}건 중
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tab Section */}
      <Card className="overflow-hidden border shadow-sm">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <div className="border-b px-4 pt-3 sm:px-6">
            <TabsList className="h-10 bg-transparent p-0">
              <TabsTrigger
                value="orders"
                className="data-[state=active]:border-b-primary relative gap-1.5 rounded-none border-b-2 border-transparent px-4 text-sm shadow-none data-[state=active]:shadow-none"
              >
                <ShoppingCart className="h-4 w-4" />
                수주관리
                {stats.totalOrders > 0 && (
                  <Badge
                    variant={mainTab === 'orders' ? 'default' : 'secondary'}
                    className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]"
                  >
                    {stats.totalOrders}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="deliveries"
                className="data-[state=active]:border-b-primary relative gap-1.5 rounded-none border-b-2 border-transparent px-4 text-sm shadow-none data-[state=active]:shadow-none"
              >
                <Truck className="h-4 w-4" />
                출하관리
                {stats.totalDeliveries > 0 && (
                  <Badge
                    variant={mainTab === 'deliveries' ? 'default' : 'secondary'}
                    className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]"
                  >
                    {stats.totalDeliveries}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="p-4 sm:p-6">
            <TabsContent value="orders" className="mt-0">
              <OrdersPanel />
            </TabsContent>
            <TabsContent value="deliveries" className="mt-0">
              <DeliveriesPanel />
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </div>
  )
}

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// Select removed - online page no longer needs channel filter
import { OrdersPanel } from '@/components/sales/orders-panel'
import { DeliveriesPanel } from '@/components/sales/deliveries-panel'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

interface SalesOrder {
  id: string
  status: string
  orderDate: string
  salesChannel?: string
}

interface NoteItem {
  id: string
  content: string
  relatedId: string
  createdAt: string
}

// Pipeline step index → tab & delivery status filter mapping
const STEP_CONFIG = [
  { tab: 'orders', deliveryStatus: null },        // 수주 접수
  { tab: 'deliveries', deliveryStatus: 'PREPARING' },  // 진행중 (준비중)
  { tab: 'deliveries', deliveryStatus: 'SHIPPED' },    // 출하 준비 (출하대기)
  { tab: 'deliveries', deliveryStatus: 'DELIVERED' },  // 납품 완료
] as const

export default function OrderShipmentPage() {
  const [mainTab, setMainTab] = useState<string>('orders')
  const now = new Date()
  const [kpiYear, setKpiYear] = useState(now.getFullYear())
  const [kpiMonth, setKpiMonth] = useState(now.getMonth() + 1)
  const { start: startDate, end: endDate } = useMemo(() => getMonthRange(kpiYear, kpiMonth), [kpiYear, kpiMonth])
  const [activeStep, setActiveStep] = useState<number | null>(null)

  const prevMonth = useCallback(() => {
    if (kpiMonth === 1) { setKpiYear(kpiYear - 1); setKpiMonth(12) }
    else setKpiMonth(kpiMonth - 1)
  }, [kpiYear, kpiMonth])
  const nextMonth = useCallback(() => {
    if (kpiMonth === 12) { setKpiYear(kpiYear + 1); setKpiMonth(1) }
    else setKpiMonth(kpiMonth + 1)
  }, [kpiYear, kpiMonth])

  // Build query params for date filtering
  const dateParams = useMemo(() => {
    return `&startDate=${startDate}&endDate=${endDate}`
  }, [startDate, endDate])

  // Fetch summary data for KPI cards (online only)
  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-summary', 'ONLINE', startDate, endDate],
    queryFn: () =>
      api.get(`/sales/orders?pageSize=200&salesChannel=ONLINE${dateParams}`) as Promise<{ data: SalesOrder[] }>,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch notes-based status tracking (actual workflow data)
  const { data: deliveryNotesData } = useQuery({
    queryKey: ['notes', 'DeliveryPost'],
    queryFn: () =>
      api.get('/notes?relatedTable=DeliveryPost') as Promise<{ data: NoteItem[] }>,
  })
  const { data: statusNotesData } = useQuery({
    queryKey: ['notes', 'DeliveryPostStatus'],
    queryFn: () =>
      api.get('/notes?relatedTable=DeliveryPostStatus') as Promise<{ data: NoteItem[] }>,
  })

  const stats = useMemo(() => {
    const allOrders = ordersData?.data || []
    const deliveryNotes = deliveryNotesData?.data || []
    const statusNotesArr = statusNotesData?.data || []

    const totalOrders = allOrders.length

    // Filter delivery notes by date and online channel
    const filteredDeliveryNotes = deliveryNotes.filter((n) => {
      // Only show online posts
      const channelMatch = n.content.match(/\[(온라인|오프라인)\]/)
      if (channelMatch && channelMatch[1] !== '온라인') return false
      if (startDate || endDate) {
        const noteDate = n.createdAt?.split('T')[0] || ''
        if (startDate && noteDate < startDate) return false
        if (endDate && noteDate > endDate) return false
      }
      return true
    })

    // Compute per-post status from DeliveryPostStatus notes
    // Notes are sorted by createdAt desc, so first match per relatedId is the latest
    const latestStatusByPost = new Map<string, string>()
    for (const s of statusNotesArr) {
      if (!latestStatusByPost.has(s.relatedId)) {
        latestStatusByPost.set(s.relatedId, s.content || 'PREPARING')
      }
    }

    let preparing = 0
    let shipped = 0
    let delivered = 0
    let returned = 0

    for (const note of filteredDeliveryNotes) {
      const status = latestStatusByPost.get(note.id) || 'PREPARING'
      if (status === 'PREPARING') preparing++
      else if (status === 'SHIPPED') shipped++
      else if (status === 'DELIVERED') delivered++
      else if (status === 'RETURNED') returned++
    }

    const totalPosts = filteredDeliveryNotes.length
    const fulfillmentRate =
      totalPosts > 0 ? Math.round((delivered / totalPosts) * 100) : 0

    return {
      totalOrders,
      totalPosts,
      preparing,
      shipped,
      delivered,
      returned,
      fulfillmentRate,
    }
  }, [ordersData, deliveryNotesData, statusNotesData, startDate, endDate])

  const isLoading = !ordersData && !deliveryNotesData

  // Derive delivery status filter from active pipeline step
  const deliveryStatusFilter = activeStep !== null ? (STEP_CONFIG[activeStep]?.deliveryStatus ?? null) : null

  const handlePipelineClick = useCallback((idx: number) => {
    if (activeStep === idx) {
      // Toggle off
      setActiveStep(null)
    } else {
      setActiveStep(idx)
      setMainTab(STEP_CONFIG[idx].tab)
    }
  }, [activeStep])

  const clearActiveStep = useCallback(() => {
    setActiveStep(null)
  }, [])

  const pipelineSteps = [
    { label: '수주 접수', count: stats.totalOrders, icon: ShoppingCart, color: 'blue' as const },
    { label: '진행중', count: stats.preparing, icon: Clock, color: 'amber' as const },
    { label: '출하 대기', count: stats.shipped, icon: Package, color: 'violet' as const },
    { label: '납품 완료', count: stats.delivered, icon: CheckCircle2, color: 'emerald' as const },
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
    <div className="space-y-6">
      <PageHeader
        title="발주/출고관리(온라인)"
        description="온라인 발주 등록부터 출고/납품까지 통합 관리합니다"
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

      {/* Process Pipeline Flow - Clickable */}
      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-xs font-medium">처리 현황</span>
              {activeStep !== null && (
                <button
                  onClick={clearActiveStep}
                  className="text-muted-foreground hover:text-foreground ml-1 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors"
                >
                  <X className="h-3 w-3" />
                  필터 해제
                </button>
              )}
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
              const isActive = activeStep === idx
              return (
                <div key={step.label} className="flex min-w-0 flex-1 items-center">
                  <button
                    type="button"
                    onClick={() => handlePipelineClick(idx)}
                    className={`flex min-w-[72px] flex-1 flex-col items-center gap-1.5 rounded-lg py-2 transition-all sm:min-w-[96px] ${
                      isActive
                        ? 'bg-muted/60 scale-105 shadow-sm'
                        : 'hover:bg-muted/30'
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
                      <p className={`text-[10px] font-medium leading-tight sm:text-xs ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step.label}
                      </p>
                      <p className={`mt-0.5 text-sm font-bold tabular-nums sm:text-base ${
                        isActive ? 'text-foreground' : ''
                      }`}>
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
        <Card
          className={`group cursor-pointer gap-0 border-l-4 border-l-blue-500 py-4 shadow-sm transition-all hover:shadow-md ${activeStep === 0 ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => handlePipelineClick(0)}
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
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                게시글 {stats.totalPosts}건
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`group cursor-pointer gap-0 border-l-4 border-l-amber-500 py-4 shadow-sm transition-all hover:shadow-md ${activeStep === 1 ? 'ring-2 ring-amber-500' : ''}`}
          onClick={() => handlePipelineClick(1)}
        >
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 transition-transform group-hover:scale-110 dark:bg-amber-950">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">진행중</p>
              {isLoading ? (
                <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums">{stats.preparing}</span>
                  <span className="text-muted-foreground text-xs">건</span>
                </div>
              )}
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                완료 {stats.delivered}건
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`group cursor-pointer gap-0 border-l-4 border-l-violet-500 py-4 shadow-sm transition-all hover:shadow-md ${activeStep === 2 ? 'ring-2 ring-violet-500' : ''}`}
          onClick={() => handlePipelineClick(2)}
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
                    {stats.shipped}
                  </span>
                  <span className="text-muted-foreground text-xs">건</span>
                </div>
              )}
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                반품 {stats.returned}건
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`group cursor-pointer gap-0 border-l-4 border-l-emerald-500 py-4 shadow-sm transition-all hover:shadow-md ${activeStep === 3 ? 'ring-2 ring-emerald-500' : ''}`}
          onClick={() => handlePipelineClick(3)}
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
                    {stats.delivered}
                  </span>
                  <span className="text-muted-foreground text-xs">건</span>
                </div>
              )}
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                전체 {stats.totalPosts}건 중
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tab Section */}
      <Card className="overflow-hidden border shadow-sm">
        <Tabs value={mainTab} onValueChange={(v) => { setMainTab(v); setActiveStep(null) }}>
          <div className="border-b px-4 pt-3 sm:px-6">
            <TabsList className="h-10 bg-transparent p-0">
              <TabsTrigger
                value="orders"
                className="data-[state=active]:border-b-primary relative gap-1.5 rounded-none border-b-2 border-transparent px-4 text-sm shadow-none data-[state=active]:shadow-none"
              >
                <ShoppingCart className="h-4 w-4" />
                발주관리
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
                출고관리
                {stats.totalPosts > 0 && (
                  <Badge
                    variant={mainTab === 'deliveries' ? 'default' : 'secondary'}
                    className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]"
                  >
                    {stats.totalPosts}
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
              <DeliveriesPanel statusFilter={deliveryStatusFilter} />
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </div>
  )
}

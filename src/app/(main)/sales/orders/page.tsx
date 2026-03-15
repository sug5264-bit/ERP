'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  DollarSign,
  BarChart3,
} from 'lucide-react'

interface SalesOrder {
  id: string
  status: string
  orderDate: string
  salesChannel?: string
  totalAmount: number
}

interface NoteItem {
  id: string
  content: string
  relatedId: string
  createdAt: string
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default function OrdersDashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { start, end } = useMemo(() => getMonthRange(year, month), [year, month])

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  // Fetch online orders
  const { data: onlineOrdersData, isLoading: onlineOrdersLoading } = useQuery({
    queryKey: ['dashboard-online-orders', start, end],
    queryFn: () =>
      api.get(`/sales/orders?pageSize=500&salesChannel=ONLINE&startDate=${start}&endDate=${end}`) as Promise<{ data: SalesOrder[] }>,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch offline orders
  const { data: offlineOrdersData, isLoading: offlineOrdersLoading } = useQuery({
    queryKey: ['dashboard-offline-orders', start, end],
    queryFn: () =>
      api.get(`/sales/orders?pageSize=500&salesChannel=OFFLINE&startDate=${start}&endDate=${end}`) as Promise<{ data: SalesOrder[] }>,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch notes-based delivery data for online
  const { data: deliveryNotesData, isLoading: deliveryNotesLoading } = useQuery({
    queryKey: ['notes', 'DeliveryPost'],
    queryFn: () =>
      api.get('/notes?relatedTable=DeliveryPost') as Promise<{ data: NoteItem[] }>,
  })

  const { data: statusNotesData } = useQuery({
    queryKey: ['notes', 'DeliveryPostStatus'],
    queryFn: () =>
      api.get('/notes?relatedTable=DeliveryPostStatus') as Promise<{ data: NoteItem[] }>,
  })

  // Online stats (notes-based)
  const onlineStats = useMemo(() => {
    const allOrders = onlineOrdersData?.data || []
    const deliveryNotes = deliveryNotesData?.data || []
    const statusNotesArr = statusNotesData?.data || []

    const totalOrders = allOrders.length
    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    // Filter delivery notes by date and online channel
    const filteredDeliveryNotes = deliveryNotes.filter((n) => {
      const channelMatch = n.content.match(/\[(온라인|오프라인)\]/)
      if (channelMatch && channelMatch[1] !== '온라인') return false
      const noteDate = n.createdAt?.split('T')[0] || ''
      if (noteDate < start || noteDate > end) return false
      return true
    })

    const latestStatusByPost = new Map<string, string>()
    for (const s of statusNotesArr) {
      if (!latestStatusByPost.has(s.relatedId)) {
        latestStatusByPost.set(s.relatedId, s.content || 'PREPARING')
      }
    }

    let preparing = 0
    let shipped = 0
    let delivered = 0

    for (const note of filteredDeliveryNotes) {
      const status = latestStatusByPost.get(note.id) || 'PREPARING'
      if (status === 'PREPARING') preparing++
      else if (status === 'SHIPPED') shipped++
      else if (status === 'DELIVERED') delivered++
    }

    const totalPosts = filteredDeliveryNotes.length
    const fulfillmentRate = totalPosts > 0 ? Math.round((delivered / totalPosts) * 100) : 0

    return { totalOrders, totalRevenue, preparing, shipped, delivered, totalPosts, fulfillmentRate }
  }, [onlineOrdersData, deliveryNotesData, statusNotesData, start, end])

  // Offline stats (order status-based)
  const offlineStats = useMemo(() => {
    const allOrders = offlineOrdersData?.data || []
    const totalOrders = allOrders.length
    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    let pending = 0
    let inProgress = 0
    let completed = 0

    for (const order of allOrders) {
      const s = order.status?.toUpperCase() || ''
      if (s === 'COMPLETED' || s === 'DELIVERED') completed++
      else if (s === 'PENDING' || s === 'NEW') pending++
      else inProgress++
    }

    const pendingAndInProgress = pending + inProgress
    const fulfillmentRate = totalOrders > 0 ? Math.round((completed / totalOrders) * 100) : 0

    return { totalOrders, totalRevenue, pendingAndInProgress, completed, fulfillmentRate }
  }, [offlineOrdersData])

  const isLoading = onlineOrdersLoading || offlineOrdersLoading || deliveryNotesLoading

  // Combined stats
  const combinedTotalOrders = onlineStats.totalOrders + offlineStats.totalOrders
  const combinedTotalRevenue = onlineStats.totalRevenue + offlineStats.totalRevenue
  const combinedFulfillmentRate = combinedTotalOrders > 0
    ? Math.round(((onlineStats.delivered + offlineStats.completed) / combinedTotalOrders) * 100)
    : 0

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
    return value.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="발주/출고관리"
        description="온라인 및 오프라인 발주/출고 현황을 통합하여 조회합니다"
      />

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevMonth}
          className="hover:bg-muted rounded-lg border p-2 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[140px] text-center text-lg font-semibold tabular-nums">
          {year}년 {month}월
        </span>
        <button
          onClick={handleNextMonth}
          className="hover:bg-muted rounded-lg border p-2 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Combined Summary Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="gap-0 border-l-4 border-l-slate-500 py-4 shadow-sm">
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900">
              <ShoppingCart className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">전체 발주</p>
              {isLoading ? (
                <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums">{combinedTotalOrders}</span>
                  <span className="text-muted-foreground text-xs">건</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 border-l-4 border-l-slate-500 py-4 shadow-sm">
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900">
              <DollarSign className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">전체 매출</p>
              {isLoading ? (
                <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums">{formatCurrency(combinedTotalRevenue)}</span>
                  <span className="text-muted-foreground text-xs">원</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 border-l-4 border-l-slate-500 py-4 shadow-sm">
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900">
              <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium">전체 이행률</p>
              {isLoading ? (
                <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums">{combinedFulfillmentRate}</span>
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Online & Offline Sections Side by Side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Online Section */}
        <Card className="overflow-hidden border-t-4 border-t-blue-500 shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300">
                  온라인
                </Badge>
              </div>
              <Link
                href="/sales/orders/online"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
              >
                상세보기
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Online KPI Cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-blue-50/50 p-3 dark:bg-blue-950/30">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-muted-foreground text-[10px] font-medium">총 수주</span>
                </div>
                {isLoading ? (
                  <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {onlineStats.totalOrders}
                    <span className="text-muted-foreground text-[10px] font-normal">건</span>
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-amber-50/50 p-3 dark:bg-amber-950/30">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-muted-foreground text-[10px] font-medium">진행중</span>
                </div>
                {isLoading ? (
                  <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {onlineStats.preparing}
                    <span className="text-muted-foreground text-[10px] font-normal">건</span>
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-violet-50/50 p-3 dark:bg-violet-950/30">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-muted-foreground text-[10px] font-medium">출하대기</span>
                </div>
                {isLoading ? (
                  <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {onlineStats.shipped}
                    <span className="text-muted-foreground text-[10px] font-normal">건</span>
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-emerald-50/50 p-3 dark:bg-emerald-950/30">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-muted-foreground text-[10px] font-medium">납품완료</span>
                </div>
                {isLoading ? (
                  <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {onlineStats.delivered}
                    <span className="text-muted-foreground text-[10px] font-normal">건</span>
                  </p>
                )}
              </div>
            </div>

            {/* Online Pipeline Bar */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-muted-foreground text-[10px]">이행률</span>
                <span className="text-xs font-semibold tabular-nums">
                  {isLoading ? '...' : `${onlineStats.fulfillmentRate}%`}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700 ease-out"
                  style={{ width: isLoading ? '0%' : `${onlineStats.fulfillmentRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offline Section */}
        <Card className="overflow-hidden border-t-4 border-t-green-500 shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300">
                  오프라인
                </Badge>
              </div>
              <Link
                href="/sales/orders/offline"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
              >
                상세보기
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Offline KPI Cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-green-50/50 p-3 dark:bg-green-950/30">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-muted-foreground text-[10px] font-medium">전체 발주</span>
                </div>
                {isLoading ? (
                  <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {offlineStats.totalOrders}
                    <span className="text-muted-foreground text-[10px] font-normal">건</span>
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-amber-50/50 p-3 dark:bg-amber-950/30">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-muted-foreground text-[10px] font-medium">대기/진행</span>
                </div>
                {isLoading ? (
                  <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {offlineStats.pendingAndInProgress}
                    <span className="text-muted-foreground text-[10px] font-normal">건</span>
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-emerald-50/50 p-3 dark:bg-emerald-950/30">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-muted-foreground text-[10px] font-medium">출고완료</span>
                </div>
                {isLoading ? (
                  <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {offlineStats.completed}
                    <span className="text-muted-foreground text-[10px] font-normal">건</span>
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-slate-50/50 p-3 dark:bg-slate-950/30">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  <span className="text-muted-foreground text-[10px] font-medium">총 매출액</span>
                </div>
                {isLoading ? (
                  <Loader2 className="text-muted-foreground mt-1 h-4 w-4 animate-spin" />
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {formatCurrency(offlineStats.totalRevenue)}
                    <span className="text-muted-foreground text-[10px] font-normal">원</span>
                  </p>
                )}
              </div>
            </div>

            {/* Offline Pipeline Bar */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-muted-foreground text-[10px]">이행률</span>
                <span className="text-xs font-semibold tabular-nums">
                  {isLoading ? '...' : `${offlineStats.fulfillmentRate}%`}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-700 ease-out"
                  style={{ width: isLoading ? '0%' : `${offlineStats.fulfillmentRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { SummaryCards } from '@/components/common/summary-cards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/common/status-badge'
import { SHIPPER_ORDER_STATUS_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import {
  PackagePlus,
  Truck,
  Package,
  Clock,
  ArrowRight,
  ClipboardList,
  BarChart3,
  Warehouse,
  Receipt,
  CalendarCheck,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'

export default function ShipperDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['shipper-dashboard'],
    queryFn: () => api.get('/shipper/dashboard'),
    staleTime: 60 * 1000,
  })

  const dd = data?.data as Record<string, unknown> | undefined
  const stats = dd?.stats as Record<string, number> | undefined
  const recentOrders = (dd?.recentOrders || []) as Array<{
    id: string
    orderNo: string
    recipientName: string
    itemName: string
    status: string
    createdAt: string
    trackingNo?: string
  }>
  const weeklyData = (dd?.weeklyData || []) as Array<{ date: string; count: number }>
  const monthlyStats = dd?.monthlyStats as
    | { totalOrders: number; deliveredCount: number; deliveryRate: number; avgDeliveryDays: number }
    | undefined

  const summaryItems = [
    {
      label: '금일 접수',
      value: stats?.todayCount || 0,
      icon: PackagePlus,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '처리중',
      value: stats?.processingCount || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      label: '배송중',
      value: stats?.inTransitCount || 0,
      icon: Truck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      label: '배송완료',
      value: stats?.deliveredCount || 0,
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ]

  const quickLinks = [
    { label: '주문등록', href: '/shipper/orders/online', icon: PackagePlus, color: 'text-blue-600' },
    { label: '배송현황', href: '/shipper/orders/tracking', icon: ClipboardList, color: 'text-indigo-600' },
    { label: '재고현황', href: '/shipper/inventory', icon: Warehouse, color: 'text-amber-600' },
    { label: '매출현황', href: '/shipper/sales', icon: BarChart3, color: 'text-emerald-600' },
    { label: '정산내역', href: '/shipper/settlement', icon: Receipt, color: 'text-purple-600' },
  ]

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="대시보드"
          description="배송 현황을 한눈에 확인하세요"
          actions={
            <Link href="/shipper/orders/online">
              <Button>
                <PackagePlus className="mr-2 h-4 w-4" /> 주문등록
              </Button>
            </Link>
          }
        />

        <SummaryCards items={summaryItems} isLoading={isLoading} />

        {/* Weekly Delivery Chart + Monthly Summary */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Weekly Delivery Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="h-4 w-4" />
                주간 접수 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                        fontSize: '13px',
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`${value}건`, '접수']}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.15)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
                  데이터를 불러오는 중...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Summary */}
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <CalendarCheck className="h-4 w-4" />
                이번달 요약
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                  <span className="text-muted-foreground text-sm">총 주문</span>
                  <span className="text-lg font-bold tabular-nums">{monthlyStats?.totalOrders ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-950">
                  <span className="text-muted-foreground text-sm">배송완료율</span>
                  <span className="text-lg font-bold text-green-600 tabular-nums">
                    {monthlyStats ? `${monthlyStats.deliveryRate}%` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                  <span className="text-muted-foreground text-sm">평균 배송일수</span>
                  <span className="text-lg font-bold text-blue-600 tabular-nums">
                    {monthlyStats ? `${monthlyStats.avgDeliveryDays}일` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950">
                  <span className="text-muted-foreground text-sm">배송완료</span>
                  <span className="text-lg font-bold text-indigo-600 tabular-nums">
                    {monthlyStats?.deliveredCount ?? '-'}건
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">바로가기</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="hover:bg-accent flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors sm:p-4">
                    <link.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${link.color}`} />
                    <span className="text-xs font-medium sm:text-sm">{link.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">최근 주문</CardTitle>
            <Link href="/shipper/orders/tracking">
              <Button variant="ghost" size="sm" className="text-xs">
                전체보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {recentOrders.length === 0 ? (
              <div className="text-muted-foreground py-10 text-center text-sm">등록된 주문이 없습니다</div>
            ) : (
              <div className="space-y-0">
                {recentOrders.slice(0, 8).map((order, idx) => (
                  <Link key={order.id} href={`/shipper/orders/${order.id}`}>
                    <div
                      className={`hover:bg-accent flex cursor-pointer items-center justify-between rounded-md px-2 py-2.5 text-sm transition-colors ${idx < Math.min(recentOrders.length, 8) - 1 ? 'border-b' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono text-xs">{order.orderNo}</span>
                          <StatusBadge status={order.status} labels={SHIPPER_ORDER_STATUS_LABELS} />
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          {order.recipientName} · {order.itemName}
                        </div>
                      </div>
                      <div className="text-muted-foreground ml-2 flex items-center gap-1 text-xs">
                        {formatDate(order.createdAt)}
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ShipperLayoutShell>
  )
}

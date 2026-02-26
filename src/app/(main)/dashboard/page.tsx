'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  Users,
  Package,
  FileText,
  ClipboardList,
  ShoppingCart,
  CalendarOff,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// recharts lazy load (번들 사이즈 ~200KB 절감)
const DashboardCharts = dynamic(() => import('@/components/dashboard/charts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <div className="bg-muted h-5 w-32 animate-pulse rounded" />
            <div className="bg-muted/30 h-[250px] animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  ),
})

export default function DashboardPage() {
  const { data: session } = useSession()

  // 대시보드 전체 데이터 단일 요청 (5개 HTTP 요청 → 1개)
  const { data: dashData } = useQuery({
    queryKey: ['dashboard-batch'],
    queryFn: () => api.get('/dashboard/batch') as Promise<any>,
    staleTime: 60 * 1000,
  })

  const kpi = dashData?.data?.kpi
  const empCount = kpi?.empCount || 0
  const itemCount = kpi?.itemCount || 0
  const pendingApproval = kpi?.approvalCount || 0
  const alertCount = kpi?.stockAlertCount || 0
  const pendingLeaves = kpi?.leaveCount || 0

  const trends = dashData?.data?.trends
  const salesTrend = trends?.salesAmount?.change ?? 0
  const orderTrend = trends?.orderCount?.change ?? 0
  const todayOrders = trends?.todayOrders ?? 0
  const thisMonthAmount = trends?.salesAmount?.current ?? 0

  const recentOrders = dashData?.data?.recentOrders || []
  const notices = dashData?.data?.notices || []

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title={`안녕하세요, ${session?.user?.name || '사용자'}님`} description="웰그린 ERP 대시보드입니다" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:gap-4 lg:grid-cols-5">
        <Link href="/hr/employees" className="focus-visible:outline-none">
          <Card className="card-interactive h-full">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium sm:text-sm">전체 사원</CardTitle>
              <div className="bg-muted hidden rounded-md p-1.5 sm:block">
                <Users className="text-muted-foreground h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg font-bold sm:text-2xl">
                {empCount}
                <span className="text-muted-foreground ml-0.5 text-sm font-normal">명</span>
              </div>
              {trends?.newEmployees && trends.newEmployees.current > 0 && (
                <p className="text-status-success mt-0.5 text-[10px] sm:text-xs">
                  이번 달 +{trends.newEmployees.current}명
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/inventory/items" className="focus-visible:outline-none">
          <Card className="card-interactive h-full">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium sm:text-sm">등록 품목</CardTitle>
              <div className="bg-muted hidden rounded-md p-1.5 sm:block">
                <Package className="text-muted-foreground h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg font-bold sm:text-2xl">
                {itemCount}
                <span className="text-muted-foreground ml-0.5 text-sm font-normal">건</span>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/approval/pending" className="focus-visible:outline-none">
          <Card className="card-interactive h-full">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium sm:text-sm">결재 대기</CardTitle>
              <div className="bg-status-warning-muted hidden rounded-md p-1.5 sm:block">
                <FileText className="text-status-warning h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className={`text-lg font-bold sm:text-2xl ${pendingApproval > 0 ? 'text-status-warning' : ''}`}>
                {pendingApproval}
                <span className="text-muted-foreground ml-0.5 text-sm font-normal">건</span>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/hr/leave" className="focus-visible:outline-none">
          <Card className="card-interactive h-full">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium sm:text-sm">휴가 대기</CardTitle>
              <div className="bg-status-info-muted hidden rounded-md p-1.5 sm:block">
                <CalendarOff className="text-status-info h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className={`text-lg font-bold sm:text-2xl ${pendingLeaves > 0 ? 'text-status-info' : ''}`}>
                {pendingLeaves}
                <span className="text-muted-foreground ml-0.5 text-sm font-normal">건</span>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/inventory/stock-status" className="col-span-2 focus-visible:outline-none sm:col-span-1">
          <Card className="card-interactive h-full">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium sm:text-sm">재고 부족</CardTitle>
              <div className="bg-status-danger-muted hidden rounded-md p-1.5 sm:block">
                <Package className="text-status-danger h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className={`text-lg font-bold sm:text-2xl ${alertCount > 0 ? 'text-status-danger' : ''}`}>
                {alertCount}
                <span className="text-muted-foreground ml-0.5 text-sm font-normal">건</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 매출 트렌드 요약 */}
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
            <div>
              <p className="text-muted-foreground text-xs">이번 달 매출</p>
              <p className="mt-1 text-base font-bold sm:text-xl">{formatCurrency(thisMonthAmount)}</p>
              {salesTrend !== 0 && (
                <div
                  className={`mt-1 flex items-center gap-1 text-xs font-medium ${salesTrend > 0 ? 'text-status-success' : 'text-status-danger'}`}
                >
                  {salesTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  전월 대비 {salesTrend > 0 ? '+' : ''}
                  {salesTrend}%
                </div>
              )}
              {salesTrend === 0 && (
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                  <Minus className="h-3 w-3" />
                  전월 동일
                </div>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">이번 달 발주</p>
              <p className="mt-1 text-base font-bold sm:text-xl">{trends?.orderCount?.current ?? 0}건</p>
              {orderTrend !== 0 && (
                <div
                  className={`mt-1 flex items-center gap-1 text-xs font-medium ${orderTrend > 0 ? 'text-status-success' : 'text-status-danger'}`}
                >
                  {orderTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  전월 대비 {orderTrend > 0 ? '+' : ''}
                  {orderTrend}%
                </div>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">오늘 발주</p>
              <p className="mt-1 text-base font-bold sm:text-xl">{todayOrders}건</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">발주 평균 금액</p>
              <p className="mt-1 text-base font-bold sm:text-xl">
                {(trends?.orderCount?.current ?? 0) > 0
                  ? formatCurrency(Math.round(thisMonthAmount / (trends?.orderCount?.current || 1)))
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts (lazy loaded) */}
      <Suspense>
        <DashboardCharts
          salesSummary={dashData?.data?.salesSummary ? { data: dashData.data.salesSummary } : undefined}
          dashStats={dashData?.data?.stats ? { data: dashData.data.stats } : undefined}
        />
      </Suspense>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ShoppingCart className="h-4 w-4" /> 최근 발주
            </CardTitle>
            <Link href="/sales/orders">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <ShoppingCart className="text-muted-foreground/30 h-8 w-8" />
                <p className="text-muted-foreground text-sm">발주 데이터가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-0">
                {recentOrders.slice(0, 5).map((o: any, idx: number) => (
                  <div
                    key={o.id}
                    className={`flex items-center justify-between py-2.5 text-xs sm:text-sm ${idx < Math.min(recentOrders.length, 5) - 1 ? 'border-b' : ''}`}
                  >
                    <div className="mr-2 flex-1 truncate">
                      <span className="text-muted-foreground mr-1.5 font-mono text-xs sm:mr-2">{o.orderNo}</span>
                      <span className="font-medium">{o.partner?.partnerName || '-'}</span>
                    </div>
                    <span className="font-semibold whitespace-nowrap tabular-nums">
                      {formatCurrency(Number(o.totalAmount || 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ClipboardList className="h-4 w-4" /> 공지사항
            </CardTitle>
            <Link href="/board/notices">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {notices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <ClipboardList className="text-muted-foreground/30 h-8 w-8" />
                <p className="text-muted-foreground text-sm">공지사항이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-0">
                {notices.slice(0, 5).map((n: any, idx: number) => (
                  <div
                    key={n.id}
                    className={`flex items-center justify-between py-2.5 text-xs sm:text-sm ${idx < Math.min(notices.length, 5) - 1 ? 'border-b' : ''}`}
                  >
                    <span className="flex-1 truncate">
                      {n.isPinned && <span className="text-status-danger mr-1 font-semibold">[필독]</span>}
                      {n.title}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs whitespace-nowrap tabular-nums">
                      {formatDate(n.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import { Users, Package, FileText, ClipboardList, ShoppingCart, CalendarOff, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// recharts lazy load (번들 사이즈 ~200KB 절감)
const DashboardCharts = dynamic(() => import('@/components/dashboard/charts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-[250px] animate-pulse rounded bg-muted/30" />
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
        <Link href="/hr/employees">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">전체 사원</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{empCount}명</div>
              {trends?.newEmployees && (trends.newEmployees.current > 0) && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">이번 달 +{trends.newEmployees.current}명</p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/inventory/items">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">등록 품목</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{itemCount}건</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/approval/pending">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">결재 대기</CardTitle>
              <FileText className="h-4 w-4 text-orange-500 hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className={`text-lg sm:text-2xl font-bold ${pendingApproval > 0 ? 'text-orange-600 dark:text-orange-500' : ''}`}>{pendingApproval}건</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/hr/leave">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">휴가 대기</CardTitle>
              <CalendarOff className="h-4 w-4 text-blue-500 hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className={`text-lg sm:text-2xl font-bold ${pendingLeaves > 0 ? 'text-blue-600 dark:text-blue-500' : ''}`}>{pendingLeaves}건</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/inventory/stock-status" className="col-span-2 lg:col-span-1">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">재고 부족</CardTitle>
              <Package className="h-4 w-4 text-red-500 hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className={`text-lg sm:text-2xl font-bold ${alertCount > 0 ? 'text-red-600 dark:text-red-500' : ''}`}>{alertCount}건</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 매출 트렌드 요약 */}
      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <div>
              <p className="text-xs text-muted-foreground">이번 달 매출</p>
              <p className="text-base sm:text-xl font-bold mt-0.5">{formatCurrency(thisMonthAmount)}</p>
              {salesTrend !== 0 && (
                <div className={`flex items-center gap-1 mt-0.5 text-xs font-medium ${salesTrend > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                  {salesTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  전월 대비 {salesTrend > 0 ? '+' : ''}{salesTrend}%
                </div>
              )}
              {salesTrend === 0 && <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />전월 동일</div>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">이번 달 발주</p>
              <p className="text-base sm:text-xl font-bold mt-0.5">{trends?.orderCount?.current ?? 0}건</p>
              {orderTrend !== 0 && (
                <div className={`flex items-center gap-1 mt-0.5 text-xs font-medium ${orderTrend > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                  {orderTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  전월 대비 {orderTrend > 0 ? '+' : ''}{orderTrend}%
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">오늘 발주</p>
              <p className="text-base sm:text-xl font-bold mt-0.5">{todayOrders}건</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">발주 평균 금액</p>
              <p className="text-base sm:text-xl font-bold mt-0.5">
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
        <DashboardCharts salesSummary={dashData?.data?.salesSummary ? { data: dashData.data.salesSummary } : undefined} dashStats={dashData?.data?.stats ? { data: dashData.data.stats } : undefined} />
      </Suspense>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> 최근 발주</CardTitle>
            <Link href="/sales/orders"><Button variant="ghost" size="sm" className="text-xs">더보기</Button></Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {recentOrders.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">발주 데이터가 없습니다.</p>
              </div>
            ) :
              <div className="space-y-2">{recentOrders.slice(0, 5).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between text-xs sm:text-sm border-b pb-2">
                  <div className="truncate flex-1 mr-2">
                    <span className="font-mono text-xs mr-1 sm:mr-2">{o.orderNo}</span>
                    <span>{o.partner?.partnerName || '-'}</span>
                  </div>
                  <span className="font-medium whitespace-nowrap">{formatCurrency(Number(o.totalAmount || 0))}</span>
                </div>
              ))}</div>
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> 공지사항</CardTitle>
            <Link href="/board/notices"><Button variant="ghost" size="sm" className="text-xs">더보기</Button></Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {notices.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">공지사항이 없습니다.</p>
              </div>
            ) :
              <div className="space-y-2">{notices.slice(0, 5).map((n: any) => (
                <div key={n.id} className="flex items-center justify-between text-xs sm:text-sm border-b pb-2">
                  <span className="truncate flex-1">{n.isPinned && <span className="text-red-500 mr-1">[필독]</span>}{n.title}</span>
                  <span className="text-muted-foreground text-xs ml-2 whitespace-nowrap">{formatDate(n.createdAt)}</span>
                </div>
              ))}</div>
            }
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  Package,
  FileText,
  ClipboardList,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Timer,
  Truck,
  Plus,
  Building2,
  Target,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense, useMemo, memo } from 'react'

const DashboardCharts = dynamic(() => import('@/components/dashboard/charts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <div className="skeleton-shimmer h-5 w-32" />
            <div className="skeleton-shimmer h-[250px]" />
          </CardContent>
        </Card>
      ))}
    </div>
  ),
})

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:gap-4 lg:grid-cols-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-3 sm:p-6">
            <div className="skeleton-shimmer h-4 w-16" />
            <div className="skeleton-shimmer h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// 식품 유통사 핵심 KPI
const KPI_CARDS = [
  {
    key: 'order',
    href: '/sales/orders',
    label: '금일 수주',
    unit: '건',
    Icon: ShoppingCart,
    bg: 'bg-status-success-muted',
    color: 'text-status-success',
  },
  {
    key: 'delivery',
    href: '/sales/orders',
    label: '출하 대기',
    unit: '건',
    Icon: Truck,
    bg: 'bg-status-info-muted',
    color: 'text-status-info',
  },
  { key: 'item', href: '/inventory/items', label: '등록 품목', unit: '건', Icon: Package, bg: 'bg-muted', color: '' },
  {
    key: 'stock',
    href: '/inventory/stock-status',
    label: '재고 부족',
    unit: '건',
    Icon: Package,
    bg: 'bg-status-danger-muted',
    color: 'text-status-danger',
  },
  {
    key: 'expiry',
    href: '/inventory/expiry',
    label: '유통기한 임박',
    unit: '건',
    Icon: Timer,
    bg: 'bg-status-warning-muted',
    color: 'text-status-warning',
  },
  {
    key: 'approval',
    href: '/approval/pending',
    label: '결재 대기',
    unit: '건',
    Icon: FileText,
    bg: 'bg-status-warning-muted',
    color: 'text-status-warning',
  },
] as const

interface RecentOrder {
  id: string
  orderNo: string
  totalAmount: number | string
  partner?: { partnerName: string }
}

interface Notice {
  id: string
  title: string
  isPinned: boolean
  createdAt: string
}

interface TopPartner {
  partnerName: string
  totalAmount: number
  orderCount: number
}

interface WeeklyOrder {
  day: string
  count: number
}

export default function DashboardPage() {
  const { data: session } = useSession()

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard-batch'],
    queryFn: () => api.get('/dashboard/batch') as Promise<{ data: Record<string, unknown> }>,
    staleTime: 60 * 1000,
  })

  const dd = dashData?.data as Record<string, unknown> | undefined
  const kpi = dd?.kpi as Record<string, number> | undefined
  const kpiValues: Record<string, number> = useMemo(
    () => ({
      order: kpi?.todayOrderCount || 0,
      delivery: kpi?.deliveryPendingCount || 0,
      item: kpi?.itemCount || 0,
      stock: kpi?.stockAlertCount || 0,
      expiry: kpi?.expiryAlertCount || 0,
      approval: kpi?.approvalCount || 0,
    }),
    [kpi]
  )

  const trends = dd?.trends as Record<string, Record<string, number>> | undefined
  const salesTrend = trends?.salesAmount?.change ?? 0
  const orderTrend = trends?.orderCount?.change ?? 0
  const todayOrders = (trends?.todayOrders as unknown as number) ?? 0
  const thisMonthAmount = trends?.salesAmount?.current ?? 0
  const lastMonthAmount = trends?.salesAmount?.previous ?? 0

  const recentOrders = (dd?.recentOrders as RecentOrder[]) || []
  const notices = (dd?.notices as Notice[]) || []
  const topPartners = (dd?.topPartners as TopPartner[]) || []
  const weeklyOrders = (dd?.weeklyOrders as WeeklyOrder[]) || []

  const greeting = getGreeting()

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={`${greeting}, ${session?.user?.name || '사용자'}님`}
        description="오늘의 주요 현황을 한눈에 확인하세요"
      />

      {/* KPI Cards */}
      {isLoading ? (
        <KpiSkeleton />
      ) : (
        <div className="stagger-children grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:gap-4 lg:grid-cols-6">
          {KPI_CARDS.map((card) => {
            const value = kpiValues[card.key]
            const hasAlert = value > 0 && card.color
            return (
              <Link key={card.key} href={card.href} className="focus-visible:outline-none">
                <Card className="card-interactive h-full">
                  <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs font-medium sm:text-sm">{card.label}</CardTitle>
                    <div className={`hidden rounded-md p-1.5 sm:block ${card.bg || 'bg-muted'}`}>
                      <card.Icon className={`h-3.5 w-3.5 ${card.color || 'text-muted-foreground'}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className={`animate-count-up text-lg font-bold sm:text-2xl ${hasAlert ? card.color : ''}`}>
                      {value.toLocaleString()}
                      <span className="text-muted-foreground ml-0.5 text-sm font-normal">{card.unit}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* 매출/수주 트렌드 요약 + 주간 현황 */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* 매출 트렌드 */}
        <Card className="animate-fade-in-up lg:col-span-2">
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
              <TrendItem
                label="이번 달 매출"
                value={formatCurrency(thisMonthAmount)}
                trend={salesTrend}
                trendLabel="전월 대비"
              />
              <TrendItem
                label="이번 달 수주"
                value={`${trends?.orderCount?.current ?? 0}건`}
                trend={orderTrend}
                trendLabel="전월 대비"
              />
              <TrendItem label="금일 수주" value={`${todayOrders}건`} />
              <TrendItem
                label="수주 평균 금액"
                value={
                  (trends?.orderCount?.current ?? 0) > 0
                    ? formatCurrency(Math.round(thisMonthAmount / (trends?.orderCount?.current || 1)))
                    : '-'
                }
              />
            </div>
            {/* 매출 목표 달성률 (전월 대비) */}
            {lastMonthAmount > 0 && (
              <div className="mt-4 border-t pt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Target className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="text-muted-foreground text-xs">전월 매출 대비 달성률</span>
                  </div>
                  <span
                    className={`text-xs font-bold ${thisMonthAmount >= lastMonthAmount ? 'text-status-success' : 'text-status-warning'}`}
                  >
                    {Math.round((thisMonthAmount / lastMonthAmount) * 100)}%
                  </span>
                </div>
                <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${thisMonthAmount >= lastMonthAmount ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, Math.round((thisMonthAmount / lastMonthAmount) * 100))}%` }}
                  />
                </div>
                <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                  <span>전월: {formatCurrency(lastMonthAmount)}</span>
                  <span>이번 달: {formatCurrency(thisMonthAmount)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 최근 7일 수주 추세 */}
        <Card className="animate-fade-in-up">
          <CardHeader className="p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">최근 7일 수주 추세</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {weeklyOrders.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-center">
                <ShoppingCart className="mb-2 h-6 w-6 opacity-30" />
                <p className="text-xs">최근 7일간 수주 데이터가 없습니다</p>
                <Link href="/sales/orders">
                  <Button variant="link" size="sm" className="mt-1 h-6 text-xs">
                    <Plus className="mr-1 h-3 w-3" /> 수주 등록하기
                  </Button>
                </Link>
              </div>
            ) : (
              <WeeklyChart data={weeklyOrders} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-3 p-4 sm:p-6">
                  <div className="skeleton-shimmer h-5 w-32" />
                  <div className="skeleton-shimmer h-[250px]" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <DashboardCharts
          salesSummary={dashData?.data?.salesSummary ? { data: dashData.data.salesSummary } : undefined}
          dashStats={dashData?.data?.stats ? { data: dashData.data.stats } : undefined}
        />
      </Suspense>

      {/* 거래처 매출 Top 5 + 최근 수주 + 공지사항 */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* 거래처별 매출 Top 5 */}
        <Card className="animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Building2 className="h-4 w-4" /> 거래처 매출 Top 5
            </CardTitle>
            <Link href="/partners">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {topPartners.length === 0 ? (
              <EmptyState
                icon={Building2}
                message="이번 달 거래 데이터가 없습니다"
                href="/sales/orders"
                actionLabel="수주 등록하기"
              />
            ) : (
              <div className="space-y-2.5">
                {topPartners.map((p, idx) => {
                  const maxAmount = topPartners[0]?.totalAmount || 1
                  const pct = Math.round((p.totalAmount / maxAmount) * 100)
                  return (
                    <div key={p.partnerName}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-300'}`}
                          >
                            {idx + 1}
                          </span>
                          <span className="truncate text-xs font-medium">{p.partnerName}</span>
                        </div>
                        <span className="text-xs font-semibold whitespace-nowrap tabular-nums">
                          {formatCurrency(p.totalAmount)}
                        </span>
                      </div>
                      <div className="bg-muted ml-7 h-1.5 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-muted-foreground mt-0.5 ml-7 text-[10px]">{p.orderCount}건</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 최근 수주 */}
        <Card className="animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ShoppingCart className="h-4 w-4" /> 최근 수주
            </CardTitle>
            <Link href="/sales/orders">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {recentOrders.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                message="수주 데이터가 없습니다"
                href="/sales/orders"
                actionLabel="수주 등록하기"
              />
            ) : (
              <div className="space-y-0">
                {recentOrders.slice(0, 5).map((o, idx) => (
                  <div
                    key={o.id}
                    className={`hover:bg-muted/30 flex items-center justify-between rounded-sm px-1 py-2.5 text-xs transition-colors sm:text-sm ${idx < Math.min(recentOrders.length, 5) - 1 ? 'border-b' : ''}`}
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

        {/* 공지사항 */}
        <Card className="animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ClipboardList className="h-4 w-4" /> 공지사항
            </CardTitle>
            <Link href="/board/notices">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {notices.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                message="공지사항이 없습니다"
                href="/board/notices"
                actionLabel="공지 작성하기"
              />
            ) : (
              <div className="space-y-0">
                {notices.slice(0, 5).map((n, idx) => (
                  <div
                    key={n.id}
                    className={`hover:bg-muted/30 flex items-center justify-between rounded-sm px-1 py-2.5 text-xs transition-colors sm:text-sm ${idx < Math.min(notices.length, 5) - 1 ? 'border-b' : ''}`}
                  >
                    <span className="flex-1 truncate">
                      {n.isPinned && (
                        <span className="bg-status-danger-muted text-status-danger mr-1 inline-flex items-center rounded-sm px-1 py-0.5 text-[10px] font-semibold">
                          필독
                        </span>
                      )}
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

// ─── Sub Components ───

const TrendItem = memo(function TrendItem({
  label,
  value,
  trend,
  trendLabel,
}: {
  label: string
  value: string
  trend?: number
  trendLabel?: string
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-base font-bold sm:text-xl">{value}</p>
      {trend !== undefined && trend !== 0 && (
        <div
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${trend > 0 ? 'text-status-success' : 'text-status-danger'}`}
        >
          {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trendLabel} {trend > 0 ? '+' : ''}
          {trend}%
        </div>
      )}
      {trend !== undefined && trend === 0 && (
        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <Minus className="h-3 w-3" />
          전월 동일
        </div>
      )}
    </div>
  )
})

const EmptyState = memo(function EmptyState({
  icon: Icon,
  message,
  href,
  actionLabel,
}: {
  icon: typeof ShoppingCart
  message: string
  href?: string
  actionLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10">
      <div className="bg-muted rounded-full p-3">
        <Icon className="text-muted-foreground/40 h-6 w-6" />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
      {href && actionLabel && (
        <Link href={href}>
          <Button variant="outline" size="sm" className="mt-1 h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  )
})

/** 최근 7일 수주 추세 미니 바 차트 */
const WeeklyChart = memo(function WeeklyChart({ data }: { data: WeeklyOrder[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex items-end justify-between gap-1.5 pt-2" style={{ height: 120 }}>
      {data.map((d) => {
        const heightPct = Math.max(8, (d.count / maxCount) * 100)
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-semibold tabular-nums">{d.count}</span>
            <div className="flex w-full flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t bg-indigo-500 transition-all duration-500"
                style={{ height: `${heightPct}%`, minHeight: 4 }}
              />
            </div>
            <span className="text-muted-foreground text-[9px]">{d.day}</span>
          </div>
        )
      })}
    </div>
  )
})

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '안녕하세요'
  return '수고하셨습니다'
}

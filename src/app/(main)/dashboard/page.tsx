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
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense, useMemo, memo } from 'react'

// recharts lazy load (번들 사이즈 ~200KB 절감)
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:gap-4 lg:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className={i === 5 ? 'col-span-2 sm:col-span-1' : ''}>
          <CardContent className="space-y-3 p-3 sm:p-6">
            <div className="skeleton-shimmer h-4 w-16" />
            <div className="skeleton-shimmer h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const KPI_CARDS = [
  { key: 'emp', href: '/hr/employees', label: '전체 사원', unit: '명', Icon: Users, bg: '', color: '' },
  { key: 'item', href: '/inventory/items', label: '등록 품목', unit: '건', Icon: Package, bg: '', color: '' },
  {
    key: 'approval',
    href: '/approval/pending',
    label: '결재 대기',
    unit: '건',
    Icon: FileText,
    bg: 'bg-status-warning-muted',
    color: 'text-status-warning',
  },
  {
    key: 'leave',
    href: '/hr/leave',
    label: '휴가 대기',
    unit: '건',
    Icon: CalendarOff,
    bg: 'bg-status-info-muted',
    color: 'text-status-info',
  },
  {
    key: 'stock',
    href: '/inventory/stock-status',
    label: '재고 부족',
    unit: '건',
    Icon: Package,
    bg: 'bg-status-danger-muted',
    color: 'text-status-danger',
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

export default function DashboardPage() {
  const { data: session } = useSession()

  // 대시보드 전체 데이터 단일 요청 (5개 HTTP 요청 → 1개)
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard-batch'],
    queryFn: () => api.get('/dashboard/batch') as Promise<{ data: Record<string, unknown> }>,
    staleTime: 60 * 1000,
  })

  const dd = dashData?.data as Record<string, unknown> | undefined
  const kpi = dd?.kpi as Record<string, number> | undefined
  const kpiValues: Record<string, number> = useMemo(
    () => ({
      emp: kpi?.empCount || 0,
      item: kpi?.itemCount || 0,
      approval: kpi?.approvalCount || 0,
      leave: kpi?.leaveCount || 0,
      stock: kpi?.stockAlertCount || 0,
    }),
    [kpi]
  )

  const trends = dd?.trends as Record<string, Record<string, number>> | undefined
  const salesTrend = trends?.salesAmount?.change ?? 0
  const orderTrend = trends?.orderCount?.change ?? 0
  const todayOrders = (trends?.todayOrders as unknown as number) ?? 0
  const thisMonthAmount = trends?.salesAmount?.current ?? 0

  const recentOrders = (dd?.recentOrders as RecentOrder[]) || []
  const notices = (dd?.notices as Notice[]) || []

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
        <div className="stagger-children grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:gap-4 lg:grid-cols-5">
          {KPI_CARDS.map((card, idx) => {
            const value = kpiValues[card.key]
            const hasAlert = value > 0 && card.color
            return (
              <Link
                key={card.key}
                href={card.href}
                className={`focus-visible:outline-none ${idx === 4 ? 'col-span-2 sm:col-span-1' : ''}`}
              >
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
                    {card.key === 'emp' && trends?.newEmployees && trends.newEmployees.current > 0 && (
                      <p className="text-status-success mt-0.5 text-[10px] sm:text-xs">
                        이번 달 +{trends.newEmployees.current}명
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* 매출 트렌드 요약 */}
      <Card className="animate-fade-in-up">
        <CardContent className="p-3 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
            <TrendItem
              label="이번 달 매출"
              value={formatCurrency(thisMonthAmount)}
              trend={salesTrend}
              trendLabel="전월 대비"
            />
            <TrendItem
              label="이번 달 발주"
              value={`${trends?.orderCount?.current ?? 0}건`}
              trend={orderTrend}
              trendLabel="전월 대비"
            />
            <TrendItem label="오늘 발주" value={`${todayOrders}건`} />
            <TrendItem
              label="발주 평균 금액"
              value={
                (trends?.orderCount?.current ?? 0) > 0
                  ? formatCurrency(Math.round(thisMonthAmount / (trends?.orderCount?.current || 1)))
                  : '-'
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Charts (lazy loaded) */}
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

      {/* Lists */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* 최근 발주 */}
        <Card className="animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ShoppingCart className="h-4 w-4" /> 최근 발주
            </CardTitle>
            <Link href="/sales/orders">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {recentOrders.length === 0 ? (
              <EmptyState icon={ShoppingCart} message="발주 데이터가 없습니다" />
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
              <EmptyState icon={ClipboardList} message="공지사항이 없습니다" />
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

const EmptyState = memo(function EmptyState({ icon: Icon, message }: { icon: typeof ShoppingCart; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10">
      <div className="bg-muted rounded-full p-3">
        <Icon className="text-muted-foreground/40 h-6 w-6" />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
})

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '안녕하세요'
  return '수고하셨습니다'
}

'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/format'
import { Users, Package, FileText, ClipboardList, ShoppingCart, CalendarOff } from 'lucide-react'
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
          <CardContent className="flex items-center justify-center h-[300px]">
            <div className="animate-pulse text-muted-foreground text-sm">차트 로딩중...</div>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
})

export default function DashboardPage() {
  const { data: session } = useSession()

  // KPI 카운트 쿼리 (가벼운 데이터만)
  const { data: empData } = useQuery({ queryKey: ['dash-employees'], queryFn: () => api.get('/hr/employees?pageSize=1') as Promise<any> })
  const { data: itemData } = useQuery({ queryKey: ['dash-items'], queryFn: () => api.get('/inventory/items?pageSize=1') as Promise<any> })
  const { data: approvalData } = useQuery({ queryKey: ['dash-approval'], queryFn: () => api.get('/approval/documents?filter=myApprovals&pageSize=5') as Promise<any> })
  const { data: stockAlert } = useQuery({ queryKey: ['dash-stock-alert'], queryFn: () => api.get('/inventory/stock-balance?belowSafety=true&pageSize=1') as Promise<any> })
  const { data: leaveData } = useQuery({ queryKey: ['dash-leave-pending'], queryFn: () => api.get('/hr/leave?status=REQUESTED&pageSize=1') as Promise<any> })

  // 리스트/차트 데이터
  const { data: orderData } = useQuery({ queryKey: ['dash-orders'], queryFn: () => api.get('/sales/orders?pageSize=5') as Promise<any> })
  const { data: noticeData } = useQuery({ queryKey: ['dash-notices'], queryFn: () => api.get('/board/posts?boardCode=NOTICE&pageSize=5') as Promise<any> })
  const { data: salesSummary } = useQuery({ queryKey: ['dash-sales-summary'], queryFn: () => api.get('/sales/summary') as Promise<any> })
  const { data: dashStats } = useQuery({ queryKey: ['dash-stats'], queryFn: () => api.get('/dashboard/stats') as Promise<any> })

  const empCount = empData?.meta?.totalCount || 0
  const itemCount = itemData?.meta?.totalCount || 0
  const pendingApproval = approvalData?.meta?.totalCount || 0
  const alertCount = stockAlert?.meta?.totalCount || 0
  const pendingLeaves = leaveData?.meta?.totalCount || 0

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title={`안녕하세요, ${session?.user?.name || '사용자'}님`} description="웰그린 ERP 대시보드입니다" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <Link href="/hr/employees">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">전체 사원</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{empCount}명</div>
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
              <div className={`text-lg sm:text-2xl font-bold ${pendingApproval > 0 ? 'text-orange-600' : ''}`}>{pendingApproval}건</div>
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
              <div className={`text-lg sm:text-2xl font-bold ${pendingLeaves > 0 ? 'text-blue-600' : ''}`}>{pendingLeaves}건</div>
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
              <div className={`text-lg sm:text-2xl font-bold ${alertCount > 0 ? 'text-red-600' : ''}`}>{alertCount}건</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts (lazy loaded) */}
      <Suspense>
        <DashboardCharts salesSummary={salesSummary} dashStats={dashStats} />
      </Suspense>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> 최근 발주</CardTitle>
            <Link href="/sales/orders"><Badge variant="outline" className="cursor-pointer text-xs">더보기</Badge></Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {(orderData?.data || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">발주 데이터가 없습니다.</p> :
              <div className="space-y-2">{(orderData?.data || []).slice(0, 5).map((o: any) => (
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
            <Link href="/board/notices"><Badge variant="outline" className="cursor-pointer text-xs">더보기</Badge></Link>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {(noticeData?.data || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">공지사항이 없습니다.</p> :
              <div className="space-y-2">{(noticeData?.data || []).slice(0, 5).map((n: any) => (
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

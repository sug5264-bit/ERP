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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: empData } = useQuery({ queryKey: ['dash-employees'], queryFn: () => api.get('/hr/employees?pageSize=1') as Promise<any> })
  const { data: itemData } = useQuery({ queryKey: ['dash-items'], queryFn: () => api.get('/inventory/items?pageSize=1') as Promise<any> })
  const { data: orderData } = useQuery({ queryKey: ['dash-orders'], queryFn: () => api.get('/sales/orders?pageSize=5') as Promise<any> })
  const { data: approvalData } = useQuery({ queryKey: ['dash-approval'], queryFn: () => api.get('/approval/documents?filter=myApprovals&pageSize=5') as Promise<any> })
  const { data: noticeData } = useQuery({ queryKey: ['dash-notices'], queryFn: () => api.get('/board/posts?boardCode=NOTICE&pageSize=5') as Promise<any> })
  const { data: stockAlert } = useQuery({ queryKey: ['dash-stock-alert'], queryFn: () => api.get('/inventory/stock-balance?belowSafety=true&pageSize=1') as Promise<any> })
  const { data: salesSummary } = useQuery({ queryKey: ['dash-sales-summary'], queryFn: () => api.get('/sales/summary') as Promise<any> })
  const { data: leaveData } = useQuery({ queryKey: ['dash-leave-pending'], queryFn: () => api.get('/hr/leave?status=REQUESTED&pageSize=1') as Promise<any> })
  const { data: dashStats } = useQuery({ queryKey: ['dash-stats'], queryFn: () => api.get('/dashboard/stats') as Promise<any> })

  const empCount = empData?.meta?.totalCount || 0
  const itemCount = itemData?.meta?.totalCount || 0
  const pendingApproval = approvalData?.meta?.totalCount || 0
  const alertCount = stockAlert?.meta?.totalCount || 0
  const pendingLeaves = leaveData?.meta?.totalCount || 0

  const monthlyData = (salesSummary?.data?.monthly || []).map((m: any) => ({
    month: m.month, online: m.online, offline: m.offline,
  }))

  const { deptData = [], stockData = [], leaveData: leaveStatData = [] } = dashStats?.data || {}

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-medium mb-1">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' && entry.value > 1000 ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`안녕하세요, ${session?.user?.name || '사용자'}님`} description="웰그린 ERP 대시보드입니다" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Link href="/hr/employees">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">전체 사원</CardTitle><Users className="h-4 w-4 text-muted-foreground hidden sm:block" /></CardHeader>
            <CardContent><div className="text-xl sm:text-2xl font-bold">{empCount}명</div></CardContent>
          </Card>
        </Link>
        <Link href="/inventory/items">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">등록 품목</CardTitle><Package className="h-4 w-4 text-muted-foreground hidden sm:block" /></CardHeader>
            <CardContent><div className="text-xl sm:text-2xl font-bold">{itemCount}건</div></CardContent>
          </Card>
        </Link>
        <Link href="/approval/pending">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">결재 대기</CardTitle><FileText className="h-4 w-4 text-orange-500 hidden sm:block" /></CardHeader>
            <CardContent><div className={`text-xl sm:text-2xl font-bold ${pendingApproval > 0 ? 'text-orange-600' : ''}`}>{pendingApproval}건</div></CardContent>
          </Card>
        </Link>
        <Link href="/hr/leave">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">휴가 대기</CardTitle><CalendarOff className="h-4 w-4 text-blue-500 hidden sm:block" /></CardHeader>
            <CardContent><div className={`text-xl sm:text-2xl font-bold ${pendingLeaves > 0 ? 'text-blue-600' : ''}`}>{pendingLeaves}건</div></CardContent>
          </Card>
        </Link>
        <Link href="/inventory/stock-status">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">재고 부족</CardTitle><Package className="h-4 w-4 text-red-500 hidden sm:block" /></CardHeader>
            <CardContent><div className={`text-xl sm:text-2xl font-bold ${alertCount > 0 ? 'text-red-600' : ''}`}>{alertCount}건</div></CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 월별 매출 */}
        <Card>
          <CardHeader><CardTitle className="text-sm sm:text-base">월별 매출 현황</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">매출 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="online" name="온라인" stackId="sales" fill="#3b82f6" />
                  <Bar dataKey="offline" name="오프라인" stackId="sales" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 부서별 인원 */}
        <Card>
          <CardHeader><CardTitle className="text-sm sm:text-base">부서별 인원</CardTitle></CardHeader>
          <CardContent>
            {deptData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">부서 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={deptData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="count"
                    nameKey="name"
                    label={({ name, value }: any) => `${name} (${value})`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {deptData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 재고 상위 품목 */}
        <Card>
          <CardHeader><CardTitle className="text-sm sm:text-base">재고 상위 품목</CardTitle></CardHeader>
          <CardContent>
            {stockData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">재고 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stockData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="quantity" name="수량" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 휴가 유형별 통계 */}
        <Card>
          <CardHeader><CardTitle className="text-sm sm:text-base">올해 휴가 유형별 현황</CardTitle></CardHeader>
          <CardContent>
            {leaveStatData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">휴가 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={leaveStatData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="건수" fill="#f59e0b" />
                  <Bar dataKey="days" name="일수" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> 최근 발주</CardTitle>
            <Link href="/sales/orders"><Badge variant="outline" className="cursor-pointer text-xs">더보기</Badge></Link>
          </CardHeader>
          <CardContent>
            {(orderData?.data || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">발주 데이터가 없습니다.</p> :
              <div className="space-y-2">{(orderData?.data || []).slice(0, 5).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <div className="truncate flex-1 mr-2"><span className="font-mono text-xs mr-2">{o.orderNo}</span><span>{o.partner?.partnerName || '-'}</span></div>
                  <span className="font-medium whitespace-nowrap">{formatCurrency(Number(o.totalAmount || 0))}</span>
                </div>
              ))}</div>
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> 공지사항</CardTitle>
            <Link href="/board/notices"><Badge variant="outline" className="cursor-pointer text-xs">더보기</Badge></Link>
          </CardHeader>
          <CardContent>
            {(noticeData?.data || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">공지사항이 없습니다.</p> :
              <div className="space-y-2">{(noticeData?.data || []).slice(0, 5).map((n: any) => (
                <div key={n.id} className="flex items-center justify-between text-sm border-b pb-2">
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

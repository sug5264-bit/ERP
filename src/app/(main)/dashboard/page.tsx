'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/format'
import { Users, Package, ShoppingCart, FileText, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: empData } = useQuery({ queryKey: ['dash-employees'], queryFn: () => api.get('/hr/employees?pageSize=1') as Promise<any> })
  const { data: itemData } = useQuery({ queryKey: ['dash-items'], queryFn: () => api.get('/inventory/items?pageSize=1') as Promise<any> })
  const { data: orderData } = useQuery({ queryKey: ['dash-orders'], queryFn: () => api.get('/sales/orders?pageSize=5') as Promise<any> })
  const { data: approvalData } = useQuery({ queryKey: ['dash-approval'], queryFn: () => api.get('/approval/documents?filter=myApprovals&pageSize=5') as Promise<any> })
  const { data: noticeData } = useQuery({ queryKey: ['dash-notices'], queryFn: () => api.get('/board/posts?boardCode=NOTICE&pageSize=5') as Promise<any> })
  const { data: stockAlert } = useQuery({ queryKey: ['dash-stock-alert'], queryFn: () => api.get('/inventory/stock-balance?belowSafety=true&pageSize=1') as Promise<any> })
  const { data: salesSummary } = useQuery({ queryKey: ['dash-sales-summary'], queryFn: () => api.get('/sales/summary') as Promise<any> })

  const empCount = empData?.meta?.totalCount || 0
  const itemCount = itemData?.meta?.totalCount || 0
  const pendingApproval = approvalData?.meta?.totalCount || 0
  const alertCount = stockAlert?.meta?.totalCount || 0

  const monthlyData = (salesSummary?.data?.monthly || []).map((m: any) => ({
    month: m.month,
    online: m.online,
    offline: m.offline,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-medium mb-1">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`안녕하세요, ${session?.user?.name || '사용자'}님`} description="웰그린 ERP 대시보드입니다" />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Link href="/hr/employees">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">전체 사원</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{empCount}명</div></CardContent>
          </Card>
        </Link>
        <Link href="/inventory/items">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">등록 품목</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{itemCount}건</div></CardContent>
          </Card>
        </Link>
        <Link href="/approval/pending">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">결재 대기</CardTitle><FileText className="h-4 w-4 text-orange-500" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-600">{pendingApproval}건</div></CardContent>
          </Card>
        </Link>
        <Link href="/inventory/stock-status">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">안전재고 미달</CardTitle><Package className="h-4 w-4 text-red-500" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{alertCount}건</div></CardContent>
          </Card>
        </Link>
      </div>

      {/* Content Grid: 2 columns */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">월별 매출 현황</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">매출 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatCurrency(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="online" name="온라인" stackId="sales" fill="#3b82f6" />
                  <Bar dataKey="offline" name="오프라인" stackId="sales" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Right: 최근 발주 + 공지사항 stacked */}
        <div className="space-y-6">
          {/* 최근 발주 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> 최근 발주</CardTitle>
              <Link href="/sales/orders"><Badge variant="outline" className="cursor-pointer">더보기</Badge></Link>
            </CardHeader>
            <CardContent>
              {(orderData?.data || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">발주 데이터가 없습니다.</p> :
                <div className="space-y-2">{(orderData?.data || []).slice(0, 5).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-sm border-b pb-2">
                    <div><span className="font-mono text-xs mr-2">{o.orderNo}</span><span>{o.partner?.partnerName || '-'}</span></div>
                    <span className="font-medium">{formatCurrency(Number(o.totalAmount || 0))}</span>
                  </div>
                ))}</div>
              }
            </CardContent>
          </Card>

          {/* 공지사항 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> 공지사항</CardTitle>
              <Link href="/board/notices"><Badge variant="outline" className="cursor-pointer">더보기</Badge></Link>
            </CardHeader>
            <CardContent>
              {(noticeData?.data || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">공지사항이 없습니다.</p> :
                <div className="space-y-2">{(noticeData?.data || []).slice(0, 5).map((n: any) => (
                  <div key={n.id} className="flex items-center justify-between text-sm border-b pb-2">
                    <span className="truncate flex-1">{n.isPinned && <span className="text-red-500 mr-1">[필독]</span>}{n.title}</span>
                    <span className="text-muted-foreground text-xs ml-2">{formatDate(n.createdAt)}</span>
                  </div>
                ))}</div>
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { SummaryCards } from '@/components/common/summary-cards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/common/status-badge'
import { SHIPPER_ORDER_STATUS_LABELS } from '@/lib/constants'
import { formatDate, formatCurrency } from '@/lib/format'
import { PackagePlus, Truck, Package, Clock, ArrowRight } from 'lucide-react'
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

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="대시보드"
          description="배송 현황을 한눈에 확인하세요"
          actions={
            <Link href="/shipper/orders/new">
              <Button>
                <PackagePlus className="mr-2 h-4 w-4" /> 주문등록
              </Button>
            </Link>
          }
        />

        <SummaryCards items={summaryItems} isLoading={isLoading} />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">최근 주문</CardTitle>
            <Link href="/shipper/orders">
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
                  <div
                    key={order.id}
                    className={`flex items-center justify-between py-2.5 text-sm ${idx < Math.min(recentOrders.length, 8) - 1 ? 'border-b' : ''}`}
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
                    <div className="text-muted-foreground ml-2 text-xs">{formatDate(order.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ShipperLayoutShell>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, FileText, Package, Truck, CreditCard, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function ThreePLPage() {
  const { data: shippers } = useQuery({
    queryKey: ['3pl-shippers-summary'],
    queryFn: () => api.get('/sales/3pl/shippers?pageSize=1'),
  })
  const { data: orders } = useQuery({
    queryKey: ['3pl-orders-summary'],
    queryFn: () => api.get('/sales/3pl/orders?pageSize=1'),
  })
  const { data: rates } = useQuery({
    queryKey: ['3pl-rates-summary'],
    queryFn: () => api.get('/sales/3pl/rates?pageSize=1'),
  })

  const cards = [
    { title: '화주사', value: `${shippers?.meta?.totalCount || 0}개`, icon: Building2, href: '/sales/3pl/shippers' },
    { title: '주문현황', value: `${orders?.meta?.totalCount || 0}건`, icon: Package, href: '/sales/3pl/orders' },
    { title: '등록 요율', value: `${rates?.meta?.totalCount || 0}건`, icon: FileText, href: '/sales/3pl/rates' },
  ]

  const menus = [
    { title: '화주사관리', desc: '화주사 등록 및 계정 관리', href: '/sales/3pl/shippers', icon: Building2 },
    { title: '계약/요율관리', desc: '배송 요율 및 계약 조건 관리', href: '/sales/3pl/rates', icon: FileText },
    { title: '주문접수현황', desc: '화주사 주문 접수 및 처리', href: '/sales/3pl/orders', icon: Package },
    { title: '배송관제', desc: '배송 현황 모니터링 및 관리', href: '/sales/3pl/dispatch', icon: Truck },
    { title: '정산관리', desc: '화주사별 배송비 정산', href: '/sales/3pl/settlement', icon: CreditCard },
    { title: '매출현황', desc: '3PL 매출 분석 및 리포트', href: '/sales/3pl/revenue', icon: BarChart3 },
  ]

  return (
    <div className="animate-fade-in-up space-y-6">
      <h1 className="text-lg font-bold tracking-tight sm:text-2xl">택배화주사관리</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="focus-visible:outline-none">
            <Card className="card-interactive h-full">
              <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs font-medium sm:text-sm">{card.title}</CardTitle>
                <div className="bg-muted hidden rounded-md p-1.5 sm:block">
                  <card.icon className="text-muted-foreground h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <p className="text-lg font-bold sm:text-2xl">{card.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {menus.map((menu) => (
          <Link key={menu.title} href={menu.href} className="focus-visible:outline-none">
            <Card className="card-interactive h-full">
              <CardHeader className="flex flex-row items-center gap-2 p-3 pb-1 sm:p-6 sm:pb-2">
                <menu.icon className="text-muted-foreground h-4 w-4" />
                <CardTitle className="text-sm sm:text-base">{menu.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <p className="text-muted-foreground text-xs sm:text-sm">{menu.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

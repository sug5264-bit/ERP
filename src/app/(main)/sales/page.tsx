'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { FileText, ShoppingCart, Truck, Users } from 'lucide-react'
import Link from 'next/link'

export default function SalesPage() {
  const { data: quotations } = useQuery({
    queryKey: ['sales-qt-summary'],
    queryFn: () => api.get('/sales/quotations?pageSize=1') as Promise<any>,
  })
  const { data: orders } = useQuery({
    queryKey: ['sales-so-summary'],
    queryFn: () => api.get('/sales/orders?pageSize=1') as Promise<any>,
  })
  const { data: deliveries } = useQuery({
    queryKey: ['sales-dlv-summary'],
    queryFn: () => api.get('/sales/deliveries?pageSize=1') as Promise<any>,
  })
  const { data: partners } = useQuery({
    queryKey: ['sales-partner-summary'],
    queryFn: () => api.get('/partners?partnerType=SALES&pageSize=1') as Promise<any>,
  })

  const cards = [
    { title: '견적서', value: `${quotations?.meta?.totalCount || 0}건`, icon: FileText, href: '/sales/quotations' },
    { title: '발주', value: `${orders?.meta?.totalCount || 0}건`, icon: ShoppingCart, href: '/sales/orders' },
    { title: '납품', value: `${deliveries?.meta?.totalCount || 0}건`, icon: Truck, href: '/sales/deliveries' },
    { title: '매출 거래처', value: `${partners?.meta?.totalCount || 0}개`, icon: Users, href: '/sales/partners' },
  ]

  const menus = [
    { title: '견적관리', desc: '고객 견적서 작성 및 관리', href: '/sales/quotations' },
    { title: '발주관리', desc: '발주 등록 및 관리', href: '/sales/orders' },
    { title: '반품관리', desc: '매출 반품 등록 및 관리', href: '/sales/returns' },
    { title: '거래처관리', desc: '고객 및 공급업체 관리', href: '/sales/partners' },
  ]

  return (
    <div className="animate-fade-in-up space-y-6">
      <h1 className="text-lg font-bold tracking-tight sm:text-2xl">매출 모듈</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {menus.map((menu) => (
          <Link key={menu.title} href={menu.href} className="focus-visible:outline-none">
            <Card className="card-interactive h-full">
              <CardHeader className="p-3 pb-1 sm:p-6 sm:pb-2">
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

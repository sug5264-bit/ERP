'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, ShoppingCart, PackageCheck, CreditCard } from 'lucide-react'
import Link from 'next/link'

export default function ProcurementPage() {
  const { data: requests } = useQuery({ queryKey: ['proc-req-summary'], queryFn: () => api.get('/procurement/requests?pageSize=1') as Promise<any> })
  const { data: orders } = useQuery({ queryKey: ['proc-po-summary'], queryFn: () => api.get('/procurement/orders?pageSize=1') as Promise<any> })
  const { data: receivings } = useQuery({ queryKey: ['proc-rcv-summary'], queryFn: () => api.get('/procurement/receiving?pageSize=1') as Promise<any> })
  const { data: payments } = useQuery({ queryKey: ['proc-pmt-summary'], queryFn: () => api.get('/procurement/payments?pageSize=1') as Promise<any> })

  const cards = [
    { title: '구매요청', value: `${requests?.meta?.totalCount || 0}건`, icon: FileText, href: '/procurement/requests' },
    { title: '발주', value: `${orders?.meta?.totalCount || 0}건`, icon: ShoppingCart, href: '/procurement/purchase-orders' },
    { title: '입고', value: `${receivings?.meta?.totalCount || 0}건`, icon: PackageCheck, href: '/procurement/receiving' },
    { title: '구매대금', value: `${payments?.meta?.totalCount || 0}건`, icon: CreditCard, href: '/procurement/payments' },
  ]

  const menus = [
    { title: '구매요청', desc: '부서별 구매 요청 관리', href: '/procurement/requests' },
    { title: '발주관리', desc: '공급업체 발주 등록 및 관리', href: '/procurement/purchase-orders' },
    { title: '입고관리', desc: '발주 품목 입고 처리', href: '/procurement/receiving' },
    { title: '구매대금', desc: '공급업체 대금 지급 관리', href: '/procurement/payments' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">구매 모듈</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{card.value}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {menus.map((menu) => (
          <Link key={menu.title} href={menu.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader><CardTitle className="text-base">{menu.title}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{menu.desc}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

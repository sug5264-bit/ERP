'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { Package, Warehouse, AlertTriangle, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'

export default function InventoryPage() {
  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items-summary'],
    queryFn: () => api.get('/inventory/items?pageSize=1') as Promise<any>,
  })

  const { data: balancesData } = useQuery({
    queryKey: ['inventory-balances-summary'],
    queryFn: () => api.get('/inventory/stock-balance') as Promise<any>,
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses-summary'],
    queryFn: () => api.get('/inventory/warehouses') as Promise<any>,
  })

  const itemCount = itemsData?.meta?.totalCount || 0
  const balances = balancesData?.data || []
  const warehouses = warehousesData?.data || []

  const totalValue = balances.reduce(
    (s: number, b: { quantity: number; averageCost: number }) => s + Number(b.quantity) * Number(b.averageCost),
    0
  )
  const belowSafety = balances.filter(
    (b: { quantity: number; item?: { safetyStock?: number } }) =>
      Number(b.quantity) < (b.item?.safetyStock || 0) && (b.item?.safetyStock || 0) > 0
  ).length

  const cards = [
    { title: '총 품목 수', value: `${itemCount}건`, icon: Package, href: '/inventory/items' },
    { title: '창고 수', value: `${warehouses.length}개`, icon: Warehouse, href: '/inventory/warehouses' },
    { title: '재고 가치', value: formatCurrency(totalValue), icon: ArrowLeftRight, href: '/inventory/stock-status' },
    { title: '안전재고 미달', value: `${belowSafety}건`, icon: AlertTriangle, href: '/inventory/stock-status' },
  ]

  const menus = [
    { title: '품목관리', desc: '상품/원자재 품목 등록 및 관리', href: '/inventory/items' },
    { title: '창고관리', desc: '창고 및 구역 관리', href: '/inventory/warehouses' },
    { title: '입출고', desc: '입고/출고/이동/조정 처리', href: '/inventory/stock-movement' },
    { title: '재고현황', desc: '품목별 창고별 재고 조회', href: '/inventory/stock-status' },
    { title: '거래처관리', desc: '고객 및 공급업체 관리', href: '/sales/partners' },
  ]

  return (
    <div className="animate-fade-in-up space-y-6">
      <h1 className="text-lg font-bold tracking-tight sm:text-2xl">재고 모듈</h1>
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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

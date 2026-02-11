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
    (s: number, b: any) => s + Number(b.quantity) * Number(b.averageCost), 0
  )
  const belowSafety = balances.filter(
    (b: any) => Number(b.quantity) < (b.item?.safetyStock || 0) && b.item?.safetyStock > 0
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">재고 모듈</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {menus.map((menu) => (
          <Link key={menu.title} href={menu.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-base">{menu.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{menu.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

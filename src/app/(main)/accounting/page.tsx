'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { FileText, Receipt, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'

export default function AccountingPage() {
  const { data: vouchersData } = useQuery({
    queryKey: ['accounting-vouchers-summary'],
    queryFn: () => api.get('/accounting/vouchers?pageSize=5') as Promise<any>,
  })

  const { data: ledgerData } = useQuery({
    queryKey: ['accounting-ledger-summary'],
    queryFn: () => api.get('/accounting/ledger') as Promise<any>,
  })

  const voucherCount = vouchersData?.meta?.totalCount || 0
  const accounts = ledgerData?.data || []

  const totalRevenue = accounts
    .filter((a: any) => a.accountType === 'REVENUE')
    .reduce((s: number, a: any) => s + (Number(a.totalCredit) - Number(a.totalDebit)), 0)
  const totalExpense = accounts
    .filter((a: any) => a.accountType === 'EXPENSE')
    .reduce((s: number, a: any) => s + (Number(a.totalDebit) - Number(a.totalCredit)), 0)

  const cards = [
    { title: '총 전표 수', value: `${voucherCount}건`, icon: FileText, href: '/accounting/vouchers' },
    { title: '당기 수익', value: formatCurrency(totalRevenue), icon: TrendingUp, href: '/accounting/financial-statements' },
    { title: '당기 비용', value: formatCurrency(totalExpense), icon: TrendingDown, href: '/accounting/financial-statements' },
    { title: '당기순이익', value: formatCurrency(totalRevenue - totalExpense), icon: Receipt, href: '/accounting/financial-statements' },
  ]

  const menus = [
    { title: '전표관리', desc: '전표 등록/조회/승인', href: '/accounting/vouchers' },
    { title: '분개장', desc: '분개 내역 조회', href: '/accounting/journal' },
    { title: '총계정원장', desc: '계정과목별 거래내역', href: '/accounting/ledger' },
    { title: '재무제표', desc: '재무상태표/손익계산서', href: '/accounting/financial-statements' },
    { title: '세금계산서', desc: '세금계산서 발행/관리', href: '/accounting/tax-invoice' },
    { title: '예산관리', desc: '부서별 예산 설정/조회', href: '/accounting/budget' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">회계 모듈</h1>
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

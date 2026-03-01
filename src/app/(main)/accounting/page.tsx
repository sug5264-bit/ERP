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
    queryFn: () => api.get('/accounting/vouchers?pageSize=5'),
  })

  const { data: ledgerData } = useQuery({
    queryKey: ['accounting-ledger-summary'],
    queryFn: () => api.get('/accounting/ledger'),
  })

  const voucherCount = vouchersData?.meta?.totalCount || 0
  const accounts = ledgerData?.data || []

  const totalRevenue = accounts
    .filter((a: { accountType: string }) => a.accountType === 'REVENUE')
    .reduce(
      (s: number, a: { totalCredit: number; totalDebit: number }) => s + (Number(a.totalCredit) - Number(a.totalDebit)),
      0
    )
  const totalExpense = accounts
    .filter((a: { accountType: string }) => a.accountType === 'EXPENSE')
    .reduce(
      (s: number, a: { totalDebit: number; totalCredit: number }) => s + (Number(a.totalDebit) - Number(a.totalCredit)),
      0
    )

  const cards = [
    { title: '총 전표 수', value: `${voucherCount}건`, icon: FileText, href: '/accounting/vouchers' },
    {
      title: '당기 수익',
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      href: '/accounting/financial-statements',
    },
    {
      title: '당기 비용',
      value: formatCurrency(totalExpense),
      icon: TrendingDown,
      href: '/accounting/financial-statements',
    },
    {
      title: '당기순이익',
      value: formatCurrency(totalRevenue - totalExpense),
      icon: Receipt,
      href: '/accounting/financial-statements',
    },
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
    <div className="animate-fade-in-up space-y-6">
      <h1 className="text-lg font-bold tracking-tight sm:text-2xl">회계 모듈</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="focus-visible:outline-none">
            <Card className="card-interactive h-full">
              <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs font-medium sm:text-sm">{card.title}</CardTitle>
                <div className="bg-muted rounded-md p-1.5">
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

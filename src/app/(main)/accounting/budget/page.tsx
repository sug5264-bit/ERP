'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { useState } from 'react'

interface BudgetRow {
  id: string
  status: string
  fiscalYear: { year: number }
  department: { name: string }
  details: {
    id: string
    accountSubject: { code: string; nameKo: string }
    month01: number
    month02: number
    month03: number
    month04: number
    month05: number
    month06: number
    month07: number
    month08: number
    month09: number
    month10: number
    month11: number
    month12: number
    totalAmount: number
  }[]
}

export default function BudgetPage() {
  const [yearFilter, setYearFilter] = useState('')

  const { data: yearsData } = useQuery({
    queryKey: ['accounting-fiscal-years'],
    queryFn: () => api.get('/accounting/fiscal-years'),
  })

  const qp = new URLSearchParams()
  if (yearFilter && yearFilter !== 'all') qp.set('fiscalYearId', yearFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-budget', yearFilter],
    queryFn: () => api.get(`/accounting/budget?${qp.toString()}`),
  })

  const years = yearsData?.data || []
  const budgets: BudgetRow[] = data?.data || []

  return (
    <div className="space-y-6">
      <PageHeader title="예산관리" description="부서별 예산을 설정하고 집행 현황을 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="전체 회계연도" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {years.map((y: { id: string; year: number }) => (
              <SelectItem key={y.id} value={y.id}>
                {y.year}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center">로딩 중...</p>
      ) : budgets.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center">등록된 예산이 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {budgets.map((budget) => (
            <Card key={budget.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {budget.department.name} - {budget.fiscalYear.year}년
                  </CardTitle>
                  <Badge variant={budget.status === 'DRAFT' ? 'secondary' : 'default'}>
                    {budget.status === 'DRAFT' ? '작성' : budget.status === 'APPROVED' ? '승인' : budget.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="bg-muted/50 sticky left-0 p-2 text-left">계정과목</th>
                        {Array.from({ length: 12 }, (_, i) => (
                          <th key={i} className="p-2 text-right whitespace-nowrap">
                            {i + 1}월
                          </th>
                        ))}
                        <th className="p-2 text-right font-bold">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.details.map((d) => (
                        <tr key={d.id} className="border-b">
                          <td className="bg-background sticky left-0 p-2 whitespace-nowrap">
                            <span className="font-mono text-xs">{d.accountSubject.code}</span> {d.accountSubject.nameKo}
                          </td>
                          {[
                            d.month01,
                            d.month02,
                            d.month03,
                            d.month04,
                            d.month05,
                            d.month06,
                            d.month07,
                            d.month08,
                            d.month09,
                            d.month10,
                            d.month11,
                            d.month12,
                          ].map((m, i) => (
                            <td key={i} className="p-2 text-right font-mono text-xs">
                              {Number(m) > 0 ? formatCurrency(m) : '-'}
                            </td>
                          ))}
                          <td className="p-2 text-right font-mono font-medium">{formatCurrency(d.totalAmount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-medium">
                        <td className="bg-muted/50 sticky left-0 p-2">합계</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const monthKey = `month${String(i + 1).padStart(2, '0')}` as keyof (typeof budget.details)[0]
                          const total = budget.details.reduce(
                            (s, d) => s + Number((d as Record<string, unknown>)[monthKey] || 0),
                            0
                          )
                          return (
                            <td key={i} className="p-2 text-right font-mono text-xs">
                              {total > 0 ? formatCurrency(total) : '-'}
                            </td>
                          )
                        })}
                        <td className="p-2 text-right font-mono font-bold">
                          {formatCurrency(budget.details.reduce((s, d) => s + Number(d.totalAmount), 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

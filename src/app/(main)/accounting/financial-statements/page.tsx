'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/format'

const ACCOUNT_TYPE_MAP: Record<string, string> = {
  ASSET: '자산',
  LIABILITY: '부채',
  EQUITY: '자본',
  REVENUE: '수익',
  EXPENSE: '비용',
}

interface AccountRow {
  id: string
  code: string
  nameKo: string
  accountType: string
  totalDebit: number
  totalCredit: number
}

export default function FinancialStatementsPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-ledger-fs', startDate, endDate],
    queryFn: () => api.get(`/accounting/ledger?${qp.toString()}`) as Promise<any>,
  })

  const accounts: AccountRow[] = data?.data || []

  const getByType = (type: string) => accounts.filter((a) => a.accountType === type)
  const getBalance = (row: AccountRow) => {
    if (['ASSET', 'EXPENSE'].includes(row.accountType))
      return Math.round((Number(row.totalDebit) - Number(row.totalCredit)) * 100) / 100
    return Math.round((Number(row.totalCredit) - Number(row.totalDebit)) * 100) / 100
  }
  const sumBalance = (type: string) => getByType(type).reduce((s, r) => s + getBalance(r), 0)

  const totalAssets = sumBalance('ASSET')
  const totalLiabilities = sumBalance('LIABILITY')
  const totalEquity = sumBalance('EQUITY')
  const totalRevenue = sumBalance('REVENUE')
  const totalExpense = sumBalance('EXPENSE')
  const netIncome = totalRevenue - totalExpense

  const renderSection = (type: string, label: string) => {
    const items = getByType(type)
    const total = items.reduce((s, r) => s + getBalance(r), 0)
    return (
      <div className="space-y-2">
        <h3 className="border-b pb-1 text-lg font-semibold">{label}</h3>
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-muted-foreground text-sm">해당 데이터가 없습니다.</p>
          </div>
        ) : (
          items.map((row) => (
            <div key={row.id} className="flex justify-between py-1 text-sm">
              <span>
                {row.code} {row.nameKo}
              </span>
              <span className="font-mono">{formatCurrency(getBalance(row))}</span>
            </div>
          ))
        )}
        <div className="flex justify-between border-t pt-1 font-medium">
          <span>{label} 합계</span>
          <span className="font-mono">{formatCurrency(total)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="재무제표" description="재무상태표, 손익계산서 등을 조회합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Label className="whitespace-nowrap">기간</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        <span>~</span>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading ? (
          <>
            {['총자산', '총부채', '총수익', '당기순이익'].map((label) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted h-7 w-24 animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">총자산</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatCurrency(totalAssets)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">총부채</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatCurrency(totalLiabilities)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">총수익</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">당기순이익</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${netIncome < 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(netIncome)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="bs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bs">재무상태표</TabsTrigger>
          <TabsTrigger value="is">손익계산서</TabsTrigger>
        </TabsList>
        <TabsContent value="bs">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={`skeleton-bs-${i}`}>
                  <CardContent className="space-y-3 p-6">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={`skel-${i}-${j}`} className="bg-muted h-4 animate-pulse rounded" />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>자산</CardTitle>
                </CardHeader>
                <CardContent>{renderSection('ASSET', '자산')}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>부채 및 자본</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {renderSection('LIABILITY', '부채')}
                  {renderSection('EQUITY', '자본')}
                  <div className="flex justify-between border-t-2 pt-2 font-bold">
                    <span>부채 및 자본 합계</span>
                    <span className="font-mono">{formatCurrency(totalLiabilities + totalEquity)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
        <TabsContent value="is">
          {isLoading ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`skel-is-${i}`} className="bg-muted h-4 animate-pulse rounded" />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>손익계산서</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderSection('REVENUE', '수익')}
                {renderSection('EXPENSE', '비용')}
                <div
                  className={`flex justify-between border-t-2 pt-2 text-lg font-bold ${netIncome < 0 ? 'text-destructive' : ''}`}
                >
                  <span>당기순이익</span>
                  <span className="font-mono">{formatCurrency(netIncome)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

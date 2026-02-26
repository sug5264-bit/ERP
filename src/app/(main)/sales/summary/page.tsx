'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Globe, Store, TrendingUp, ShoppingCart, Download, FileText } from 'lucide-react'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
const months = [
  { value: '', label: '전체' },
  { value: '1', label: '1월' },
  { value: '2', label: '2월' },
  { value: '3', label: '3월' },
  { value: '4', label: '4월' },
  { value: '5', label: '5월' },
  { value: '6', label: '6월' },
  { value: '7', label: '7월' },
  { value: '8', label: '8월' },
  { value: '9', label: '9월' },
  { value: '10', label: '10월' },
  { value: '11', label: '11월' },
  { value: '12', label: '12월' },
]

interface SummaryData {
  period: { year: number; month: number | null }
  online: { count: number; totalAmount: number; totalSupply: number; totalTax: number }
  offline: { count: number; totalAmount: number; totalSupply: number; totalTax: number }
  total: { count: number; totalAmount: number }
  monthly: { month: string; online: number; offline: number; total: number }[]
  topItems: { itemCode: string; itemName: string; online: number; offline: number; total: number; qty: number }[]
}

export default function SalesSummaryPage() {
  const [year, setYear] = useState(String(currentYear))
  const [month, setMonth] = useState('')

  const qp = new URLSearchParams({ year })
  if (month) qp.set('month', month)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-summary', year, month],
    queryFn: () => api.get(`/sales/summary?${qp.toString()}`) as Promise<any>,
  })

  const summary: SummaryData | null = data?.data || null

  const onlineRatio =
    summary && summary.total.totalAmount > 0
      ? Math.round((summary.online.totalAmount / summary.total.totalAmount) * 100)
      : 0

  const exportItemColumns: ExportColumn[] = [
    { header: '품목코드', accessor: 'itemCode' },
    { header: '품목명', accessor: 'itemName' },
    { header: '수량', accessor: 'qty' },
    { header: '온라인', accessor: (r) => formatCurrency(r.online) },
    { header: '오프라인', accessor: (r) => formatCurrency(r.offline) },
    { header: '합계', accessor: (r) => formatCurrency(r.total) },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    if (!summary) return
    const periodLabel = month ? `${year}년 ${month}월` : `${year}년`
    const cfg = {
      fileName: `매출집계_${periodLabel}`,
      title: `매출집계 - ${periodLabel}`,
      columns: exportItemColumns,
      data: summary.topItems,
    }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="매출집계" description="온라인/오프라인 매출 현황을 분석합니다" />

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-24">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value || 'all'} value={m.value || 'all'}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <Download className="mr-1 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
            <FileText className="mr-1 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center">데이터를 불러오는 중...</div>
      ) : !summary ? (
        <div className="text-muted-foreground py-12 text-center">데이터가 없습니다.</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">전체 매출</CardTitle>
                <TrendingUp className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.total.totalAmount)}</div>
                <p className="text-muted-foreground mt-1 text-xs">{summary.total.count}건</p>
              </CardContent>
            </Card>
            <Card className="bg-status-info-muted border-[var(--color-info)]/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">온라인 매출</CardTitle>
                <Globe className="text-status-info h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-status-info text-2xl font-bold">{formatCurrency(summary.online.totalAmount)}</div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {summary.online.count}건 · {onlineRatio}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-status-warning-muted border-[var(--color-warning)]/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">오프라인 매출</CardTitle>
                <Store className="text-status-warning h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-status-warning text-2xl font-bold">
                  {formatCurrency(summary.offline.totalAmount)}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {summary.offline.count}건 · {100 - onlineRatio}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">평균 주문금액</CardTitle>
                <ShoppingCart className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.total.count > 0
                    ? formatCurrency(Math.round(summary.total.totalAmount / summary.total.count))
                    : '0'}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">건당 평균</p>
              </CardContent>
            </Card>
          </div>

          {/* Channel comparison bar */}
          {summary.total.totalAmount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">채널별 매출 비율</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-8 overflow-hidden rounded-lg">
                  {onlineRatio > 0 && (
                    <div
                      className="flex items-center justify-center bg-[var(--color-info)] text-xs font-medium text-white"
                      style={{ width: `${onlineRatio}%` }}
                    >
                      {onlineRatio > 10 ? `온라인 ${onlineRatio}%` : ''}
                    </div>
                  )}
                  {100 - onlineRatio > 0 && (
                    <div
                      className="flex items-center justify-center bg-[var(--color-warning)] text-xs font-medium text-white"
                      style={{ width: `${100 - onlineRatio}%` }}
                    >
                      {100 - onlineRatio > 10 ? `오프라인 ${100 - onlineRatio}%` : ''}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-[var(--color-info)]" />
                    <span>온라인: {formatCurrency(summary.online.totalAmount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-[var(--color-warning)]" />
                    <span>오프라인: {formatCurrency(summary.offline.totalAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monthly breakdown */}
          {summary.monthly.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">월별 매출 추이</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-3 text-left">월</th>
                        <th className="p-3 text-right">
                          <span className="flex items-center justify-end gap-1">
                            <div className="h-2 w-2 rounded bg-[var(--color-info)]" /> 온라인
                          </span>
                        </th>
                        <th className="p-3 text-right">
                          <span className="flex items-center justify-end gap-1">
                            <div className="h-2 w-2 rounded bg-[var(--color-warning)]" /> 오프라인
                          </span>
                        </th>
                        <th className="p-3 text-right font-semibold">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.monthly.map((m) => (
                        <tr key={m.month} className="border-b">
                          <td className="p-3 font-medium">{m.month}</td>
                          <td className="text-status-info p-3 text-right font-mono">{formatCurrency(m.online)}</td>
                          <td className="text-status-warning p-3 text-right font-mono">{formatCurrency(m.offline)}</td>
                          <td className="p-3 text-right font-mono font-semibold">{formatCurrency(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-semibold">
                        <td className="p-3">합계</td>
                        <td className="text-status-info p-3 text-right font-mono">
                          {formatCurrency(summary.online.totalAmount)}
                        </td>
                        <td className="text-status-warning p-3 text-right font-mono">
                          {formatCurrency(summary.offline.totalAmount)}
                        </td>
                        <td className="p-3 text-right font-mono">{formatCurrency(summary.total.totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top items */}
          {summary.topItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">품목별 매출 TOP 10</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-3 text-left">순위</th>
                        <th className="p-3 text-left">품목코드</th>
                        <th className="p-3 text-left">품목명</th>
                        <th className="p-3 text-right">수량</th>
                        <th className="p-3 text-right">온라인</th>
                        <th className="p-3 text-right">오프라인</th>
                        <th className="p-3 text-right font-semibold">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topItems.map((item, idx) => (
                        <tr key={item.itemCode} className="border-b">
                          <td className="p-3">
                            <Badge variant={idx < 3 ? 'default' : 'secondary'}>{idx + 1}</Badge>
                          </td>
                          <td className="p-3 font-mono text-xs">{item.itemCode}</td>
                          <td className="p-3 font-medium">{item.itemName}</td>
                          <td className="p-3 text-right font-mono">{item.qty}</td>
                          <td className="text-status-info p-3 text-right font-mono">{formatCurrency(item.online)}</td>
                          <td className="text-status-warning p-3 text-right font-mono">
                            {formatCurrency(item.offline)}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

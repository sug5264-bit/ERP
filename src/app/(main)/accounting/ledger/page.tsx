'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColumnDef } from '@tanstack/react-table'
import { formatDate, formatCurrency } from '@/lib/format'
import { ArrowLeft } from 'lucide-react'

const ACCOUNT_TYPE_MAP: Record<string, string> = {
  ASSET: '자산', LIABILITY: '부채', EQUITY: '자본', REVENUE: '수익', EXPENSE: '비용',
}

interface LedgerSummary { id: string; code: string; nameKo: string; accountType: string; totalDebit: number; totalCredit: number }
interface LedgerDetail {
  id: string; debitAmount: number; creditAmount: number; description: string | null
  voucher: { voucherNo: string; voucherDate: string; voucherType: string; description: string | null }
  partner: { partnerName: string } | null
}

const detailColumns: ColumnDef<LedgerDetail>[] = [
  { header: '전표번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.voucher.voucherNo}</span> },
  { header: '일자', cell: ({ row }) => formatDate(row.original.voucher.voucherDate) },
  { header: '차변', cell: ({ row }) => Number(row.original.debitAmount) > 0 ? formatCurrency(row.original.debitAmount) : '-' },
  { header: '대변', cell: ({ row }) => Number(row.original.creditAmount) > 0 ? formatCurrency(row.original.creditAmount) : '-' },
  { header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
  { header: '적요', cell: ({ row }) => row.original.description || row.original.voucher.description || '-' },
]

export default function LedgerPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (selectedAccountId) qp.set('accountSubjectId', selectedAccountId)

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-ledger', startDate, endDate, selectedAccountId],
    queryFn: () => api.get(`/accounting/ledger?${qp.toString()}`) as Promise<any>,
  })

  if (selectedAccountId) {
    const ledgerData = data?.data || {}
    const account = ledgerData.account
    const details: LedgerDetail[] = ledgerData.details || []

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAccountId(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> 뒤로
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{account?.code} - {account?.nameKo}</h1>
            <p className="text-sm text-muted-foreground">총계정원장 상세 ({ACCOUNT_TYPE_MAP[account?.accountType] || ''})</p>
          </div>
        </div>
        <DataTable columns={detailColumns} data={details} isLoading={isLoading} pageSize={100} />
      </div>
    )
  }

  const summaries: LedgerSummary[] = data?.data || []

  return (
    <div className="space-y-6">
      <PageHeader title="총계정원장" description="계정과목별 거래 내역을 조회합니다" />
      <div className="flex items-center gap-4">
        <Label className="whitespace-nowrap">기간</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        <span>~</span>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
      </div>
      {!isLoading && summaries.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Object.entries(ACCOUNT_TYPE_MAP).map(([key, label]) => {
            const items = summaries.filter((s) => s.accountType === key)
            const debit = items.reduce((s, i) => s + Number(i.totalDebit), 0)
            const credit = items.reduce((s, i) => s + Number(i.totalCredit), 0)
            return (
              <Card key={key}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">차변: {formatCurrency(debit)}</div>
                  <div className="text-xs text-muted-foreground">대변: {formatCurrency(credit)}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">계정코드</th><th className="p-3 text-left">계정과목</th><th className="p-3 text-left">구분</th>
              <th className="p-3 text-right">차변 합계</th><th className="p-3 text-right">대변 합계</th><th className="p-3 text-right">잔액</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">로딩 중...</td></tr>
            ) : summaries.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">데이터가 없습니다.</td></tr>
            ) : summaries.map((row) => {
              const balance = Number(row.totalDebit) - Number(row.totalCredit)
              return (
                <tr key={row.id} className="border-b cursor-pointer hover:bg-muted/50" onClick={() => setSelectedAccountId(row.id)}>
                  <td className="p-3 font-mono">{row.code}</td>
                  <td className="p-3 font-medium">{row.nameKo}</td>
                  <td className="p-3"><Badge variant="outline">{ACCOUNT_TYPE_MAP[row.accountType]}</Badge></td>
                  <td className="p-3 text-right">{formatCurrency(row.totalDebit)}</td>
                  <td className="p-3 text-right">{formatCurrency(row.totalCredit)}</td>
                  <td className="p-3 text-right">
                    <span className={balance < 0 ? 'text-destructive' : ''}>{formatCurrency(Math.abs(balance))}{balance < 0 ? ' (대)' : balance > 0 ? ' (차)' : ''}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'

interface JournalRow {
  id: string
  lineNo: number
  debitAmount: number
  creditAmount: number
  description: string | null
  voucher: { voucherNo: string; voucherDate: string; voucherType: string; description: string | null; status: string }
  accountSubject: { code: string; nameKo: string; accountType: string }
  partner: { partnerName: string } | null
}

const TYPE_MAP: Record<string, string> = {
  RECEIPT: '입금',
  PAYMENT: '출금',
  TRANSFER: '대체',
  PURCHASE: '매입',
  SALES: '매출',
}

const columns: ColumnDef<JournalRow>[] = [
  {
    header: '전표번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.voucher.voucherNo}</span>,
  },
  { header: '전표일자', cell: ({ row }) => formatDate(row.original.voucher.voucherDate) },
  {
    header: '유형',
    cell: ({ row }) => (
      <Badge variant="outline">{TYPE_MAP[row.original.voucher.voucherType] || row.original.voucher.voucherType}</Badge>
    ),
  },
  {
    header: '계정코드',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.accountSubject.code}</span>,
  },
  { header: '계정과목', cell: ({ row }) => row.original.accountSubject.nameKo },
  {
    header: '차변',
    cell: ({ row }) => (Number(row.original.debitAmount) > 0 ? formatCurrency(row.original.debitAmount) : '-'),
  },
  {
    header: '대변',
    cell: ({ row }) => (Number(row.original.creditAmount) > 0 ? formatCurrency(row.original.creditAmount) : '-'),
  },
  { header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
  { header: '적요', cell: ({ row }) => row.original.description || row.original.voucher.description || '-' },
]

export default function JournalPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [accountId, setAccountId] = useState('')

  const qp = new URLSearchParams({ pageSize: '100' })
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (accountId && accountId !== 'all') qp.set('accountSubjectId', accountId)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['accounting-journal', startDate, endDate, accountId],
    queryFn: () => api.get(`/accounting/journal?${qp.toString()}`),
  })
  const { data: accountsData } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts'),
  })

  const entries: JournalRow[] = data?.data || []
  const accounts = accountsData?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '전표번호', accessor: (r) => r.voucher.voucherNo },
    { header: '전표일자', accessor: (r) => r.voucher.voucherDate },
    { header: '유형', accessor: (r) => TYPE_MAP[r.voucher.voucherType] || r.voucher.voucherType },
    { header: '계정코드', accessor: (r) => r.accountSubject.code },
    { header: '계정과목', accessor: (r) => r.accountSubject.nameKo },
    { header: '차변', accessor: (r) => Number(r.debitAmount) },
    { header: '대변', accessor: (r) => Number(r.creditAmount) },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '적요', accessor: (r) => r.description || r.voucher.description || '' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '분개장', title: '분개장', columns: exportColumns, data: entries }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="분개장" description="전표의 분개 내역을 조회합니다" />
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">기간</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          <span>~</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="전체 계정과목" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {accounts.map((a: { id: string; code: string; nameKo: string }) => (
              <SelectItem key={a.id} value={a.id}>
                {a.code} - {a.nameKo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={entries}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={100}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />
    </div>
  )
}

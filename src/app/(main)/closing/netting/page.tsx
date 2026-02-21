'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'

interface NettingDetail {
  voucherNo: string
  voucherDate: string
  voucherType: string
  account: string
  debit: number
  credit: number
  description: string | null
}

interface NettingRow {
  partnerId: string
  partnerCode: string
  partnerName: string
  receivable: number
  payable: number
  netAmount: number
  details: NettingDetail[]
}

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function NettingPage() {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(currentYear.toString())
  const [month, setMonth] = useState(currentMonth.toString())
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<NettingRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [formPartnerId, setFormPartnerId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formDescription, setFormDescription] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['closing-netting', year, month],
    queryFn: () => api.get(`/closing/netting?year=${year}&month=${month}`) as Promise<any>,
  })

  const { data: partnersData } = useQuery({
    queryKey: ['partners-all'],
    queryFn: () => api.get('/partners?pageSize=200') as Promise<any>,
  })
  const partners = (partnersData?.data || [])

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/closing/netting', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closing-netting'] })
      setCreateOpen(false)
      setFormPartnerId(''); setFormAmount(''); setFormDescription('')
      setFormDate(new Date().toISOString().slice(0, 10))
      toast.success('상계 내역이 등록되었습니다.')
    },
    onError: (err: any) => toast.error(err?.message || '등록에 실패했습니다.'),
  })

  const handleCreateNetting = () => {
    if (!formPartnerId || !formAmount || !formDate) {
      toast.error('거래처, 금액, 상계일을 입력하세요.')
      return
    }
    const amount = parseFloat(formAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('올바른 금액을 입력하세요.')
      return
    }
    createMutation.mutate({
      partnerId: formPartnerId,
      amount,
      nettingDate: formDate,
      description: formDescription,
    })
  }

  const rows: NettingRow[] = data?.data || []

  const totalReceivable = rows.reduce((sum, r) => sum + r.receivable, 0)
  const totalPayable = rows.reduce((sum, r) => sum + r.payable, 0)
  const totalNet = rows.reduce((sum, r) => sum + r.netAmount, 0)

  const openDetail = (row: NettingRow) => {
    setSelectedPartner(row)
    setDetailOpen(true)
  }

  const columns: ColumnDef<NettingRow>[] = [
    {
      accessorKey: 'partnerCode',
      header: '거래처코드',
    },
    {
      accessorKey: 'partnerName',
      header: '거래처명',
      cell: ({ row }) => (
        <button
          className="text-left font-medium hover:underline"
          onClick={() => openDetail(row.original)}
        >
          {row.original.partnerName}
        </button>
      ),
    },
    {
      accessorKey: 'receivable',
      header: '매출채권(원)',
      cell: ({ row }) => (
        <span className="text-blue-600">{formatCurrency(row.original.receivable)}</span>
      ),
    },
    {
      accessorKey: 'payable',
      header: '매입채무(원)',
      cell: ({ row }) => (
        <span className="text-red-600">{formatCurrency(row.original.payable)}</span>
      ),
    },
    {
      accessorKey: 'netAmount',
      header: '상계금액(원)',
      cell: ({ row }) => {
        const net = row.original.netAmount
        return (
          <Badge variant={net >= 0 ? 'default' : 'destructive'}>
            {net >= 0 ? '+' : ''}{formatCurrency(net)}
          </Badge>
        )
      },
    },
    {
      id: 'detailCount',
      header: '거래건수',
      cell: ({ row }) => `${row.original.details.length}건`,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => openDetail(row.original)}>
          상세
        </Button>
      ),
    },
  ]

  const voucherTypeLabel: Record<string, string> = {
    RECEIPT: '입금',
    PAYMENT: '출금',
    TRANSFER: '대체',
    PURCHASE: '매입',
    SALES: '매출',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="상계내역"
        description="월별 거래처별 매출채권/매입채무 상계 내역을 조회합니다"
      />

      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <Label>연도</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>월</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={m.toString()}>{m}월</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)}>상계 등록</Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">총 매출채권</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalReceivable)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">총 매입채무</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPayable)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">순 상계금액</p>
          <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {totalNet >= 0 ? '+' : ''}{formatCurrency(totalNet)}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchColumn="partnerName"
        searchPlaceholder="거래처명으로 검색..."
        isLoading={isLoading}
      />

      {/* 상계 등록 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>상계 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>거래처 *</Label>
              <Select value={formPartnerId} onValueChange={setFormPartnerId}>
                <SelectTrigger><SelectValue placeholder="거래처 선택" /></SelectTrigger>
                <SelectContent>
                  {partners.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>상계금액 *</Label>
              <Input type="number" placeholder="0" required min="1" step="1" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>상계일 *</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>적요</Label>
              <Textarea placeholder="상계 사유를 입력하세요" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreateNetting} disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '상계 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPartner?.partnerName} - 상계 상세내역 ({year}년 {month}월)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">매출채권: </span>
                <span className="font-medium text-blue-600">
                  {formatCurrency(selectedPartner?.receivable || 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">매입채무: </span>
                <span className="font-medium text-red-600">
                  {formatCurrency(selectedPartner?.payable || 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">순액: </span>
                <span className="font-bold">
                  {formatCurrency(selectedPartner?.netAmount || 0)}
                </span>
              </div>
            </div>
            <div className="max-h-[40vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">전표번호</th>
                    <th className="px-3 py-2 text-left">일자</th>
                    <th className="px-3 py-2 text-left">유형</th>
                    <th className="px-3 py-2 text-left">계정</th>
                    <th className="px-3 py-2 text-right">차변</th>
                    <th className="px-3 py-2 text-right">대변</th>
                    <th className="px-3 py-2 text-left">적요</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPartner?.details.map((d, i) => (
                    <tr key={i} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-xs">{d.voucherNo}</td>
                      <td className="px-3 py-2">{formatDate(d.voucherDate)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">
                          {voucherTypeLabel[d.voucherType] || d.voucherType}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{d.account}</td>
                      <td className="px-3 py-2 text-right">
                        {d.debit > 0 ? formatCurrency(d.debit) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {d.credit > 0 ? formatCurrency(d.credit) : '-'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{d.description || '-'}</td>
                    </tr>
                  ))}
                  {(!selectedPartner?.details || selectedPartner.details.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                        해당 월에 거래 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

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

interface PaymentRow {
  id: string
  voucherNo: string
  voucherDate: string
  description: string | null
  totalAmount: number
  status: string
  createdBy: string
  partner: {
    id: string
    partnerCode: string
    partnerName: string
  } | null
  details: {
    account: string
    debit: number
    credit: number
    description: string | null
  }[]
}

interface PartnerItem {
  id: string
  partnerCode: string
  partnerName: string
}

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '임시저장',
  APPROVED: '승인',
  CONFIRMED: '확정',
}

export default function PaymentsPage() {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(currentYear.toString())
  const [month, setMonth] = useState(currentMonth.toString())
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null)

  // 지급 등록 폼
  const [formPartnerId, setFormPartnerId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formDescription, setFormDescription] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['closing-payments', year, month],
    queryFn: () => api.get(`/closing/payments?year=${year}&month=${month}`) as Promise<any>,
  })

  const { data: partnersData } = useQuery({
    queryKey: ['partners-all'],
    queryFn: () => api.get('/partners?pageSize=200') as Promise<any>,
  })

  const rows: PaymentRow[] = data?.data || []
  const partners: PartnerItem[] = (partnersData?.data || []).map((p: any) => ({
    id: p.id,
    partnerCode: p.partnerCode,
    partnerName: p.partnerName,
  }))

  const totalAmount = rows.reduce((sum, r) => sum + r.totalAmount, 0)

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/accounting/vouchers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closing-payments'] })
      setCreateOpen(false)
      resetForm()
      toast.success('대금지급 전표가 생성되었습니다.')
    },
    onError: (err: any) => toast.error(err?.message || '전표 생성에 실패했습니다.'),
  })

  const resetForm = () => {
    setFormPartnerId('')
    setFormAmount('')
    setFormDate(new Date().toISOString().slice(0, 10))
    setFormDescription('')
  }

  const handleCreate = () => {
    if (!formPartnerId || !formAmount || !formDate) {
      toast.error('거래처, 금액, 지급일을 입력하세요.')
      return
    }
    const amount = parseFloat(formAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('올바른 금액을 입력하세요.')
      return
    }
    createMutation.mutate({
      voucherType: 'PAYMENT',
      voucherDate: formDate,
      description: formDescription || `거래처 대금지급`,
      details: [
        {
          accountCode: '2100',
          debitAmount: amount,
          creditAmount: 0,
          partnerId: formPartnerId,
          description: '매입채무 상환',
        },
        {
          accountCode: '1020',
          debitAmount: 0,
          creditAmount: amount,
          description: '보통예금 출금',
        },
      ],
    })
  }

  const openDetail = (row: PaymentRow) => {
    setSelectedPayment(row)
    setDetailOpen(true)
  }

  const columns: ColumnDef<PaymentRow>[] = [
    {
      accessorKey: 'voucherNo',
      header: '전표번호',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.voucherNo}</span>
      ),
    },
    {
      accessorKey: 'voucherDate',
      header: '지급일',
      cell: ({ row }) => formatDate(row.original.voucherDate),
    },
    {
      id: 'partner',
      header: '거래처',
      cell: ({ row }) => row.original.partner?.partnerName || '-',
    },
    {
      accessorKey: 'description',
      header: '적요',
      cell: ({ row }) => row.original.description || '-',
    },
    {
      accessorKey: 'totalAmount',
      header: '지급금액(원)',
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => {
        const s = row.original.status
        const variant = s === 'CONFIRMED' ? 'default' : s === 'APPROVED' ? 'secondary' : 'outline'
        return <Badge variant={variant}>{STATUS_LABELS[s] || s}</Badge>
      },
    },
    {
      accessorKey: 'createdBy',
      header: '작성자',
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="대금지급"
        description="거래처 대금 지급 내역을 관리합니다"
      />

      <div className="flex items-end justify-between">
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
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true) }}>
          대금지급 등록
        </Button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">총 지급건수</p>
          <p className="text-2xl font-bold">{rows.length}건</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">총 지급금액</p>
          <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchColumn="voucherNo"
        searchPlaceholder="전표번호로 검색..."
        isLoading={isLoading}
      />

      {/* 대금지급 등록 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>대금지급 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>거래처 *</Label>
              <Select value={formPartnerId} onValueChange={setFormPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="거래처 선택" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.partnerCode}] {p.partnerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>지급금액 *</Label>
              <Input
                type="number"
                placeholder="0"
                required
                min="1"
                step="1"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>지급일 *</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>적요</Label>
              <Textarea
                placeholder="지급 사유를 입력하세요"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>지급 상세 - {selectedPayment?.voucherNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">거래처: </span>
                <span className="font-medium">{selectedPayment?.partner?.partnerName || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">지급일: </span>
                <span className="font-medium">{formatDate(selectedPayment?.voucherDate || '')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">지급금액: </span>
                <span className="font-bold">{formatCurrency(selectedPayment?.totalAmount || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">상태: </span>
                <Badge variant="secondary">
                  {STATUS_LABELS[selectedPayment?.status || ''] || selectedPayment?.status}
                </Badge>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">적요: </span>
                <span>{selectedPayment?.description || '-'}</span>
              </div>
            </div>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">계정과목</th>
                    <th className="px-3 py-2 text-right">차변</th>
                    <th className="px-3 py-2 text-right">대변</th>
                    <th className="px-3 py-2 text-left">적요</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPayment?.details.map((d, i) => (
                    <tr key={i} className="border-t">
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
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

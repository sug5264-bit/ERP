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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/format'
import { generateTransactionStatementPDF, type TransactionStatementPDFData } from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { FileText } from 'lucide-react'
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
  const [formDate, setFormDate] = useState(getLocalDateString())
  const [formDescription, setFormDescription] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['closing-netting', year, month],
    queryFn: () => api.get(`/closing/netting?year=${year}&month=${month}`) as Promise<any>,
  })

  const { data: partnersData } = useQuery({
    queryKey: ['partners-all'],
    queryFn: () => api.get('/partners?pageSize=200') as Promise<any>,
  })
  const partners = partnersData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/closing/netting', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closing-netting'] })
      setCreateOpen(false)
      setFormPartnerId('')
      setFormAmount('')
      setFormDescription('')
      setFormDate(getLocalDateString())
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

  // 거래명세표 발행 - 발주 데이터 조회
  const ordersStartDate = `${year}-${month.padStart(2, '0')}-01`
  const ordersEndDate = (() => {
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    return `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  })()

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['netting-orders', year, month],
    queryFn: () =>
      api.get(`/sales/orders?startDate=${ordersStartDate}&endDate=${ordersEndDate}&pageSize=200`) as Promise<any>,
  })

  const { data: companyData } = useQuery({
    queryKey: ['admin-company'],
    queryFn: () => api.get('/admin/company') as Promise<any>,
    staleTime: 30 * 60 * 1000,
  })

  const getCompanyInfo = () => {
    const companies = companyData?.data || []
    const defaultCompany = companies.find((c: any) => c.isDefault) || companies[0]
    if (defaultCompany) {
      return {
        name: defaultCompany.companyName,
        bizNo: defaultCompany.bizNo || '',
        ceo: defaultCompany.ceoName || '',
        address: defaultCompany.address || '',
        bizType: defaultCompany.bizType || '',
        bizItem: defaultCompany.bizCategory || '',
        tel: defaultCompany.phone || '',
      }
    }
    return { name: COMPANY_NAME, bizNo: '', ceo: '', address: '', bizType: '', bizItem: '', tel: '' }
  }

  const handleTransactionStatementPDF = async (order: any) => {
    let orderDetail = order
    try {
      const res = (await api.get(`/sales/orders/${order.id}`)) as any
      orderDetail = res.data || res
    } catch {
      toast.error('주문 상세 정보를 불러올 수 없습니다.')
      return
    }
    const ci = getCompanyInfo()
    const companies = companyData?.data || []
    const company = companies.find((c: any) => c.isDefault) || companies[0]
    const items = (orderDetail.details || []).map((d: any, idx: number) => ({
      no: idx + 1,
      barcode: d.item?.barcode || '',
      itemName: d.item?.itemName || '',
      spec: d.item?.specification || '',
      unit: d.item?.unit || 'EA',
      qty: Number(d.quantity),
      unitPrice: Number(d.unitPrice),
      supplyAmount: Number(d.supplyAmount),
      taxAmount: Number(d.taxAmount),
      remark: d.remark || '',
    }))
    const totalQty = items.reduce((s: number, it: any) => s + it.qty, 0)
    const pdfData: TransactionStatementPDFData = {
      statementNo: orderDetail.orderNo,
      statementDate: formatDate(orderDetail.orderDate),
      supplier: {
        name: ci.name,
        bizNo: ci.bizNo,
        ceo: ci.ceo,
        address: ci.address,
        tel: ci.tel,
        bankName: company?.bankName || '',
        bankAccount: company?.bankAccount || '',
        bankHolder: company?.bankHolder || '',
      },
      buyer: {
        name: orderDetail.partner?.partnerName || '',
        bizNo: orderDetail.partner?.bizNo || '',
        ceo: orderDetail.partner?.ceoName || '',
        address: orderDetail.partner?.address || '',
        tel: orderDetail.partner?.phone || '',
      },
      items,
      totalQty,
      totalSupply: Number(orderDetail.totalSupply),
      totalTax: Number(orderDetail.totalTax),
      totalAmount: Number(orderDetail.totalAmount),
    }
    generateTransactionStatementPDF(pdfData)
    toast.success('거래명세서 PDF가 다운로드되었습니다.')
  }

  const orders: any[] = ordersData?.data || []

  const ORDER_STATUS_MAP: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    ORDERED: { label: '발주', variant: 'default' },
    IN_PROGRESS: { label: '진행중', variant: 'secondary' },
    COMPLETED: { label: '완료', variant: 'outline' },
    CANCELLED: { label: '취소', variant: 'destructive' },
    COMPLAINT: { label: '컨플레인', variant: 'destructive' },
    EXCHANGE: { label: '교환', variant: 'secondary' },
    RETURN: { label: '반품', variant: 'destructive' },
  }

  const orderColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'orderNo',
      header: '발주번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span>,
    },
    {
      id: 'orderDate',
      header: '발주일',
      cell: ({ row }) => formatDate(row.original.orderDate),
    },
    {
      id: 'partner',
      header: '거래처',
      cell: ({ row }) => row.original.partner?.partnerName || '-',
    },
    {
      id: 'totalAmount',
      header: '합계금액',
      cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span>,
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => {
        const s = ORDER_STATUS_MAP[row.original.status] || { label: row.original.status, variant: 'outline' as const }
        return <Badge variant={s.variant}>{s.label}</Badge>
      },
    },
    {
      id: 'transactionStatement',
      header: '거래명세서',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => handleTransactionStatementPDF(row.original)}>
          <FileText className="mr-1 h-4 w-4" />
          발행
        </Button>
      ),
    },
  ]

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
        <button className="text-left font-medium hover:underline" onClick={() => openDetail(row.original)}>
          {row.original.partnerName}
        </button>
      ),
    },
    {
      accessorKey: 'receivable',
      header: '매출채권(원)',
      cell: ({ row }) => <span className="text-status-info">{formatCurrency(row.original.receivable)}</span>,
    },
    {
      accessorKey: 'payable',
      header: '매입채무(원)',
      cell: ({ row }) => <span className="text-status-danger">{formatCurrency(row.original.payable)}</span>,
    },
    {
      accessorKey: 'netAmount',
      header: '상계금액(원)',
      cell: ({ row }) => {
        const net = row.original.netAmount
        return (
          <Badge variant={net >= 0 ? 'default' : 'destructive'}>
            {net >= 0 ? '+' : ''}
            {formatCurrency(net)}
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
      <PageHeader title="상계내역" description="월별 거래처별 매출채권/매입채무 상계 내역을 조회합니다" />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>연도</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}년
                </SelectItem>
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
                <SelectItem key={m} value={m.toString()}>
                  {m}월
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)}>상계 등록</Button>
      </div>

      <Tabs defaultValue="netting" className="space-y-4">
        <TabsList>
          <TabsTrigger value="netting">상계내역</TabsTrigger>
          <TabsTrigger value="transactionStatement">
            <FileText className="mr-1 h-4 w-4" />
            거래명세서 발행
          </TabsTrigger>
        </TabsList>

        <TabsContent value="netting" className="space-y-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">총 매출채권</p>
              <p className="text-status-info text-2xl font-bold">{formatCurrency(totalReceivable)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">총 매입채무</p>
              <p className="text-status-danger text-2xl font-bold">{formatCurrency(totalPayable)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">순 상계금액</p>
              <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-status-info' : 'text-status-danger'}`}>
                {totalNet >= 0 ? '+' : ''}
                {formatCurrency(totalNet)}
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
        </TabsContent>

        <TabsContent value="transactionStatement" className="space-y-6">
          <div className="rounded-lg border p-4">
            <h3 className="mb-1 text-lg font-semibold">거래명세서 발행 (발주관리 연동)</h3>
            <p className="text-muted-foreground text-sm">
              {year}년 {month}월 발주 내역을 기반으로 거래명세서를 발행합니다. 발주 상세정보와 거래처 정보가 자동으로
              반영됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">해당 기간 발주 건수</p>
              <p className="text-2xl font-bold">{orders.length}건</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">발주 합계금액</p>
              <p className="text-2xl font-bold">
                {formatCurrency(orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0))}
              </p>
            </div>
          </div>

          <DataTable
            columns={orderColumns}
            data={orders}
            searchColumn="orderNo"
            searchPlaceholder="발주번호로 검색..."
            isLoading={ordersLoading}
          />
        </TabsContent>
      </Tabs>

      {/* 상계 등록 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>상계 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                거래처 <span className="text-destructive">*</span>
              </Label>
              <Select value={formPartnerId} onValueChange={setFormPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="거래처 선택" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.partnerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                상계금액 <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                placeholder="0"
                required
                aria-required="true"
                min="1"
                step="1"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                상계일 <span className="text-destructive">*</span>
              </Label>
              <Input type="date" aria-required="true" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>적요</Label>
              <Textarea
                placeholder="상계 사유를 입력하세요"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateNetting} disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '상계 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPartner?.partnerName} - 상계 상세내역 ({year}년 {month}월)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">매출채권: </span>
                <span className="text-status-info font-medium">{formatCurrency(selectedPartner?.receivable || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">매입채무: </span>
                <span className="text-status-danger font-medium">{formatCurrency(selectedPartner?.payable || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">순액: </span>
                <span className="font-bold">{formatCurrency(selectedPartner?.netAmount || 0)}</span>
              </div>
            </div>
            <div className="max-h-[40vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
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
                    <tr key={i} className="hover:bg-muted/20 border-t">
                      <td className="px-3 py-2 font-mono text-xs">{d.voucherNo}</td>
                      <td className="px-3 py-2">{formatDate(d.voucherDate)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">
                          {voucherTypeLabel[d.voucherType] || d.voucherType}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{d.account}</td>
                      <td className="px-3 py-2 text-right">{d.debit > 0 ? formatCurrency(d.debit) : '-'}</td>
                      <td className="px-3 py-2 text-right">{d.credit > 0 ? formatCurrency(d.credit) : '-'}</td>
                      <td className="text-muted-foreground px-3 py-2">{d.description || '-'}</td>
                    </tr>
                  ))}
                  {(!selectedPartner?.details || selectedPartner.details.length === 0) && (
                    <tr>
                      <td colSpan={7} className="text-muted-foreground px-3 py-8 text-center">
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

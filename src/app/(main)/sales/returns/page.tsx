'use client'

import { useState, useMemo } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Paperclip, FileText, CalendarDays, Table2 } from 'lucide-react'
import { RecordSubTabs, savePendingData } from '@/components/common/record-sub-tabs'
import { CalendarView, type CalendarEvent } from '@/components/common/calendar-view'

interface ReturnRow {
  id: string
  returnNo: string
  returnDate: string
  reason: string
  reasonDetail: string | null
  status: string
  totalAmount: number
  salesOrder: { id: string; orderNo: string } | null
  partner: { id: string; partnerName: string } | null
}

const REASON_MAP: Record<string, string> = {
  DEFECT: '불량',
  WRONG_ITEM: '오배송',
  CUSTOMER_CHANGE: '고객변심',
  QUALITY_ISSUE: '품질문제',
  OTHER: '기타',
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  REQUESTED: { label: '요청', variant: 'outline' },
  APPROVED: { label: '승인', variant: 'default' },
  COMPLETED: { label: '완료', variant: 'secondary' },
  REJECTED: { label: '반려', variant: 'destructive' },
}

export default function ReturnsPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingNote, setPendingNote] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<{ date: string; events: CalendarEvent[] } | null>(
    null
  )

  const qp = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-returns', statusFilter],
    queryFn: () => api.get(`/sales/returns?${qp.toString()}`) as Promise<any>,
  })

  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-for-return'],
    queryFn: () => api.get('/sales/orders?pageSize=200') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })

  const { data: partnersData } = useQuery({
    queryKey: ['partners-all'],
    queryFn: () => api.get('/partners?pageSize=200') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/returns', body),
    onSuccess: async (res: any) => {
      const record = res.data || res
      if (record?.id && (pendingFiles.length > 0 || pendingNote.trim())) {
        await savePendingData('SalesReturn', record.id, pendingFiles, pendingNote)
      }
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      setCreateOpen(false)
      setPendingFiles([])
      setPendingNote('')
      toast.success('반품이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/sales/returns/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      toast.success('상태가 변경되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      salesOrderId: form.get('salesOrderId'),
      partnerId: form.get('partnerId'),
      returnDate: form.get('returnDate'),
      reason: form.get('reason'),
      reasonDetail: form.get('reasonDetail') || undefined,
      totalAmount: parseFloat(form.get('totalAmount') as string) || 0,
    })
  }

  const returns: ReturnRow[] = data?.data || []
  const orders = ordersData?.data || []
  const partners = partnersData?.data || []

  // Calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const reasonVariant: Record<string, CalendarEvent['variant']> = {
      DEFECT: 'danger',
      WRONG_ITEM: 'warning',
      CUSTOMER_CHANGE: 'info',
      QUALITY_ISSUE: 'danger',
      OTHER: 'default',
    }
    return returns.map((r) => ({
      id: r.id,
      date: r.returnDate?.split('T')[0] || '',
      label: `${r.returnNo} ${r.partner?.partnerName || ''}`.trim(),
      sublabel: `${REASON_MAP[r.reason] || r.reason} · ${formatCurrency(r.totalAmount)}`,
      variant: reasonVariant[r.reason] || 'default',
    }))
  }, [returns])

  const columns: ColumnDef<ReturnRow>[] = [
    {
      accessorKey: 'returnNo',
      header: '반품번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.returnNo}</span>,
    },
    { accessorKey: 'returnDate', header: '반품일', cell: ({ row }) => formatDate(row.original.returnDate) },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    { id: 'orderNo', header: '수주번호', cell: ({ row }) => row.original.salesOrder?.orderNo || '-' },
    {
      id: 'reason',
      header: '사유',
      cell: ({ row }) => <Badge variant="outline">{REASON_MAP[row.original.reason] || row.original.reason}</Badge>,
    },
    { accessorKey: 'totalAmount', header: '반품금액', cell: ({ row }) => formatCurrency(row.original.totalAmount) },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => {
        const s = STATUS_MAP[row.original.status]
        return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'REQUESTED' ? (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={updateStatusMutation.isPending}
              onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: 'APPROVED' })}
            >
              승인
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={updateStatusMutation.isPending}
              onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: 'REJECTED' })}
            >
              반려
            </Button>
          </div>
        ) : row.original.status === 'APPROVED' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={updateStatusMutation.isPending}
            onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: 'COMPLETED' })}
          >
            완료
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="반품관리" description="매출 반품을 등록하고 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>반품 등록</Button>
        <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() => setViewMode('table')}
          >
            <Table2 className="h-3.5 w-3.5" /> 테이블
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="h-3.5 w-3.5" /> 캘린더
          </Button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="space-y-4">
          <CalendarView
            events={calendarEvents}
            onDateClick={(date, events) => setCalendarSelectedDate({ date, events })}
            maxEventsPerCell={3}
          />
          <Dialog open={!!calendarSelectedDate} onOpenChange={(v) => !v && setCalendarSelectedDate(null)}>
            <DialogContent className="max-h-[80vh] max-w-sm overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{calendarSelectedDate?.date} 반품 내역</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {calendarSelectedDate?.events.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{evt.label}</p>
                      <p className="text-muted-foreground text-xs">{evt.sublabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={returns}
          searchColumn="returnNo"
          searchPlaceholder="반품번호로 검색..."
          isLoading={isLoading}
        />
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>반품 등록</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Tabs defaultValue="info">
              <TabsList variant="line">
                <TabsTrigger value="info">기본 정보</TabsTrigger>
                <TabsTrigger value="files">
                  <Paperclip className="mr-1 h-3.5 w-3.5" />
                  특이사항{pendingFiles.length > 0 && <span className="ml-1 text-xs">({pendingFiles.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="notes">
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  게시글
                </TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      수주 선택 <span className="text-destructive">*</span>
                    </Label>
                    <Select name="salesOrderId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="수주 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>
                            [{o.orderNo}] {o.partner?.partnerName || ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      거래처 <span className="text-destructive">*</span>
                    </Label>
                    <Select name="partnerId" required>
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
                      반품일 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      name="returnDate"
                      type="date"
                      required
                      aria-required="true"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      반품사유 <span className="text-destructive">*</span>
                    </Label>
                    <Select name="reason" required>
                      <SelectTrigger>
                        <SelectValue placeholder="사유 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(REASON_MAP).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>반품금액</Label>
                    <Input name="totalAmount" type="number" placeholder="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>상세 사유</Label>
                  <Textarea name="reasonDetail" placeholder="반품 상세 사유를 입력하세요" />
                </div>
              </TabsContent>
              <RecordSubTabs
                relatedTable="SalesReturn"
                pendingFiles={pendingFiles}
                onPendingFilesChange={setPendingFiles}
                pendingNote={pendingNote}
                onPendingNoteChange={setPendingNote}
              />
            </Tabs>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '반품 등록'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'

const STATUS_MAP: Record<string, string> = { REQUESTED: '요청', APPROVED: '승인', ORDERED: '발주전환', REJECTED: '반려' }

interface Detail { itemId: string; quantity: number; desiredDate?: string }

const columns: ColumnDef<any>[] = [
  { accessorKey: 'requestNo', header: '요청번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.requestNo}</span> },
  { header: '요청일', cell: ({ row }) => formatDate(row.original.requestDate) },
  { header: '부서', cell: ({ row }) => row.original.department?.name || '-' },
  { header: '품목수', cell: ({ row }) => `${row.original.details?.length || 0}건` },
  { header: '사유', cell: ({ row }) => row.original.reason || '-' },
  { header: '상태', cell: ({ row }) => <Badge variant="outline">{STATUS_MAP[row.original.status] || row.original.status}</Badge> },
]

export default function RequestsPage() {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', quantity: 1 }])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['procurement-requests'], queryFn: () => api.get('/procurement/requests?pageSize=50') as Promise<any> })
  const { data: deptsData } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/hr/departments') as Promise<any> })
  const { data: itemsData } = useQuery({ queryKey: ['items-all'], queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/procurement/requests', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['procurement-requests'] }); setOpen(false); setDetails([{ itemId: '', quantity: 1 }]); toast.success('구매요청이 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const departments = deptsData?.data || []
  const items = itemsData?.data || []

  const updateDetail = (idx: number, field: string, value: any) => { const d = [...details]; (d[idx] as any)[field] = value; setDetails(d) }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      requestDate: form.get('requestDate'), departmentId: form.get('departmentId'),
      reason: form.get('reason') || undefined,
      details: details.filter(d => d.itemId),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="구매요청" description="부서별 구매 요청을 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>구매요청 등록</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>구매요청 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>요청일 *</Label><Input name="requestDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>부서 *</Label>
                  <Select name="departmentId"><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>사유</Label><Input name="reason" /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>품목</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDetails([...details, { itemId: '', quantity: 1 }])}><Plus className="mr-1 h-3 w-3" /> 행 추가</Button>
                </div>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50"><th className="p-2 text-left">품목</th><th className="p-2 w-24">수량</th><th className="p-2 w-36">희망납기일</th><th className="p-2 w-10"></th></tr></thead>
                    <tbody>{details.map((d, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-1"><Select value={d.itemId} onValueChange={v => updateDetail(idx, 'itemId', v)}><SelectTrigger><SelectValue placeholder="품목 선택" /></SelectTrigger><SelectContent>{items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.itemCode} - {it.itemName}</SelectItem>)}</SelectContent></Select></td>
                        <td className="p-1"><Input type="number" value={d.quantity || ''} onChange={e => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-1"><Input type="date" value={d.desiredDate || ''} onChange={e => updateDetail(idx, 'desiredDate', e.target.value)} /></td>
                        <td className="p-1"><Button type="button" variant="ghost" size="icon" onClick={() => details.length > 1 && setDetails(details.filter((_, i) => i !== idx))} disabled={details.length <= 1}><Trash2 className="h-3 w-3" /></Button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '등록 중...' : '구매요청 등록'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={data?.data || []} searchColumn="requestNo" searchPlaceholder="요청번호로 검색..." isLoading={isLoading} pageSize={50} />
    </div>
  )
}

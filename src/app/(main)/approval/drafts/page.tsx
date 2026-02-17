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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Trash2, Send } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFTED: { label: '임시저장', variant: 'secondary' },
  IN_PROGRESS: { label: '진행중', variant: 'default' },
  APPROVED: { label: '승인', variant: 'outline' },
  REJECTED: { label: '반려', variant: 'destructive' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

interface Step { approverId: string; approvalType: string }

const columns: ColumnDef<any>[] = [
  { accessorKey: 'documentNo', header: '문서번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.documentNo}</span> },
  { header: '제목', accessorKey: 'title' },
  { id: 'draftDate', header: '기안일', cell: ({ row }) => formatDate(row.original.draftDate) },
  { id: 'urgency', header: '긴급도', cell: ({ row }) => row.original.urgency === 'URGENT' ? <Badge variant="destructive">긴급</Badge> : row.original.urgency === 'EMERGENCY' ? <Badge variant="destructive">초긴급</Badge> : <Badge variant="outline">일반</Badge> },
  { id: 'progress', header: '진행', cell: ({ row }) => <span className="text-sm">{row.original.currentStep}/{row.original.totalSteps}</span> },
  { id: 'status', header: '상태', cell: ({ row }) => { const s = STATUS_MAP[row.original.status]; return <Badge variant={s?.variant || 'outline'}>{s?.label || row.original.status}</Badge> } },
]

export default function ApprovalDraftsPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [steps, setSteps] = useState<Step[]>([{ approverId: '', approvalType: 'APPROVE' }])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['approval-my-drafts'], queryFn: () => api.get('/approval/documents?filter=myDrafts&pageSize=50') as Promise<any> })
  const { data: employeesData } = useQuery({ queryKey: ['employees-all'], queryFn: () => api.get('/hr/employees?pageSize=500') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/approval/documents', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['approval-my-drafts'] }); setOpen(false); setSteps([{ approverId: '', approvalType: 'APPROVE' }]); toast.success('결재문서가 생성되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/approval/documents/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['approval-my-drafts'] }); setDetailOpen(false); toast.success('처리되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const employees = employeesData?.data || []

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      title: form.get('title'), draftDate: form.get('draftDate'),
      urgency: form.get('urgency') || 'NORMAL',
      content: { body: form.get('content') },
      steps: steps.filter(s => s.approverId),
    })
  }

  const handleRowClick = async (row: any) => {
    try {
      const res = await api.get(`/approval/documents/${row.id}`) as any
      setSelectedDoc(res.data || res)
      setDetailOpen(true)
    } catch { toast.error('문서를 불러올 수 없습니다.') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="내 기안문서" description="기안한 결재 문서를 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>기안 작성</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>기안 작성</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>제목 *</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>기안일 *</Label><Input name="draftDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>긴급도</Label>
                  <Select name="urgency" defaultValue="NORMAL"><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="NORMAL">일반</SelectItem><SelectItem value="URGENT">긴급</SelectItem><SelectItem value="EMERGENCY">초긴급</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>내용</Label><Textarea name="content" rows={6} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>결재선</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSteps([...steps, { approverId: '', approvalType: 'APPROVE' }])}><Plus className="mr-1 h-3 w-3" /> 결재자 추가</Button>
                </div>
                <div className="space-y-2">
                  {steps.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-8">{idx + 1}.</span>
                      <Select value={s.approverId} onValueChange={v => { const ns = [...steps]; ns[idx].approverId = v; setSteps(ns) }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="결재자 선택" /></SelectTrigger>
                        <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nameKo} ({e.position?.name || '-'} / {e.department?.name || '-'})</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={s.approvalType} onValueChange={v => { const ns = [...steps]; ns[idx].approvalType = v; setSteps(ns) }}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="APPROVE">결재</SelectItem><SelectItem value="REVIEW">검토</SelectItem><SelectItem value="NOTIFY">통보</SelectItem></SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" onClick={() => steps.length > 1 && setSteps(steps.filter((_, i) => i !== idx))} disabled={steps.length <= 1}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '생성 중...' : '기안 작성'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={data?.data || []} searchColumn="title" searchPlaceholder="제목으로 검색..." isLoading={isLoading} pageSize={50} onRowClick={handleRowClick} />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedDoc?.title}</DialogTitle></DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">문서번호:</span> {selectedDoc.documentNo}</div>
                <div><span className="text-muted-foreground">기안일:</span> {formatDate(selectedDoc.draftDate)}</div>
                <div><span className="text-muted-foreground">상태:</span> {STATUS_MAP[selectedDoc.status]?.label || selectedDoc.status}</div>
                <div><span className="text-muted-foreground">기안자:</span> {selectedDoc.drafter?.nameKo}</div>
              </div>
              <div className="border rounded-md p-3 text-sm whitespace-pre-wrap">{selectedDoc.content?.body || '-'}</div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">결재선</Label>
                {(selectedDoc.steps || []).map((step: any, idx: number) => (
                  <div key={step.id} className="flex items-center gap-2 text-sm">
                    <span className="w-6">{idx + 1}.</span>
                    <span className="flex-1">{step.approver?.nameKo || '-'}</span>
                    <Badge variant={step.status === 'APPROVED' ? 'default' : step.status === 'REJECTED' ? 'destructive' : 'outline'}>
                      {step.status === 'APPROVED' ? '승인' : step.status === 'REJECTED' ? '반려' : step.status === 'PENDING' ? '대기' : step.status}
                    </Badge>
                  </div>
                ))}
              </div>
              {selectedDoc.status === 'DRAFTED' && (
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => actionMutation.mutate({ id: selectedDoc.id, body: { action: 'submit' } })} disabled={actionMutation.isPending}><Send className="mr-1 h-4 w-4" /> 상신</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => actionMutation.mutate({ id: selectedDoc.id, body: { action: 'cancel' } })} disabled={actionMutation.isPending}>취소</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

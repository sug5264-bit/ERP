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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Mail, Send } from 'lucide-react'

const receivedColumns: ColumnDef<any>[] = [
  { id: 'isRead', header: '', cell: ({ row }) => !row.original.isRead ? <Badge variant="default" className="text-xs">NEW</Badge> : null, size: 50 },
  { accessorKey: 'subject', header: '제목' },
  { id: 'sender', header: '보낸사람', cell: ({ row }) => row.original.sender?.name || '-' },
  { id: 'sentAt', header: '수신일', cell: ({ row }) => formatDate(row.original.sentAt) },
]

const sentColumns: ColumnDef<any>[] = [
  { accessorKey: 'subject', header: '제목' },
  { id: 'receiver', header: '받는사람', cell: ({ row }) => row.original.receiver?.name || '-' },
  { id: 'sentAt', header: '발신일', cell: ({ row }) => formatDate(row.original.sentAt) },
  { id: 'isRead', header: '읽음', cell: ({ row }) => row.original.isRead ? <Badge variant="outline">읽음</Badge> : <Badge variant="secondary">안읽음</Badge> },
]

export default function MessagesPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedMsg, setSelectedMsg] = useState<any>(null)
  const [tab, setTab] = useState('received')
  const queryClient = useQueryClient()

  const { data: receivedData, isLoading: rLoading } = useQuery({ queryKey: ['messages-received'], queryFn: () => api.get('/board/messages?box=received&pageSize=50') as Promise<any> })
  const { data: sentData, isLoading: sLoading } = useQuery({ queryKey: ['messages-sent'], queryFn: () => api.get('/board/messages?box=sent&pageSize=50') as Promise<any> })
  const { data: usersData } = useQuery({ queryKey: ['users-all'], queryFn: () => api.get('/admin/users?pageSize=500') as Promise<any> })

  const sendMutation = useMutation({
    mutationFn: (body: any) => api.post('/board/messages', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['messages-sent'] }); setOpen(false); toast.success('메시지를 보냈습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const users = usersData?.data || []

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    sendMutation.mutate({ receiverId: form.get('receiverId'), subject: form.get('subject'), content: form.get('content') })
  }

  const handleRowClick = async (row: any) => {
    setSelectedMsg(row)
    setDetailOpen(true)
    if (!row.isRead && tab === 'received') {
      try {
        await api.put('/board/messages', { messageId: row.id })
        queryClient.invalidateQueries({ queryKey: ['messages-received'] })
      } catch {
        // 읽음 처리 실패 시 무시 (UX에 영향 없음)
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="사내 메시지" description="사내 메시지를 주고받습니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Send className="mr-1 h-4 w-4" /> 메시지 보내기</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>메시지 보내기</DialogTitle></DialogHeader>
            <form onSubmit={handleSend} className="space-y-4">
              <div className="space-y-2">
                <Label>받는사람 *</Label>
                <Select name="receiverId"><SelectTrigger><SelectValue placeholder="수신자 선택" /></SelectTrigger>
                  <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>제목 *</Label><Input name="subject" required /></div>
              <div className="space-y-2"><Label>내용 *</Label><Textarea name="content" rows={6} required /></div>
              <Button type="submit" className="w-full" disabled={sendMutation.isPending}>{sendMutation.isPending ? '전송 중...' : '메시지 보내기'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="received" className="flex items-center gap-1"><Mail className="h-4 w-4" /> 받은 메시지</TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-1"><Send className="h-4 w-4" /> 보낸 메시지</TabsTrigger>
        </TabsList>
        <TabsContent value="received">
          <DataTable columns={receivedColumns} data={receivedData?.data || []} searchColumn="subject" searchPlaceholder="제목으로 검색..." isLoading={rLoading} pageSize={50} onRowClick={handleRowClick} />
        </TabsContent>
        <TabsContent value="sent">
          <DataTable columns={sentColumns} data={sentData?.data || []} searchColumn="subject" searchPlaceholder="제목으로 검색..." isLoading={sLoading} pageSize={50} onRowClick={handleRowClick} />
        </TabsContent>
      </Tabs>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedMsg?.subject}</DialogTitle></DialogHeader>
          {selectedMsg && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>보낸사람: {selectedMsg.sender?.name}</span>
                <span>받는사람: {selectedMsg.receiver?.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(selectedMsg.sentAt)}</div>
              <div className="border rounded-md p-4 text-sm whitespace-pre-wrap min-h-[150px]">{selectedMsg.content}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

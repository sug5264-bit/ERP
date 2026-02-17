'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Megaphone, MessageSquare, Mail } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/format'

export default function BoardPage() {
  const { data: notices } = useQuery({ queryKey: ['board-notices-summary'], queryFn: () => api.get('/board/posts?boardCode=NOTICE&pageSize=5') as Promise<any> })
  const { data: general } = useQuery({ queryKey: ['board-general-summary'], queryFn: () => api.get('/board/posts?boardCode=GENERAL&pageSize=5') as Promise<any> })
  const { data: messages } = useQuery({ queryKey: ['board-messages-summary'], queryFn: () => api.get('/board/messages?box=received&pageSize=5') as Promise<any> })

  const unreadCount = (messages?.data || []).filter((m: any) => !m.isRead).length

  return (
    <div className="space-y-6">
      <PageHeader title="게시판" description="공지사항, 자유게시판, 사내메시지를 관리합니다" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">공지사항</CardTitle><Megaphone className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{notices?.meta?.totalCount || 0}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">자유게시판</CardTitle><MessageSquare className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{general?.meta?.totalCount || 0}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">읽지 않은 메시지</CardTitle><Mail className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{unreadCount}</div></CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">공지사항</CardTitle>
            <Link href="/board/notices"><Button variant="ghost" size="sm">더보기</Button></Link>
          </CardHeader>
          <CardContent>
            {(notices?.data || []).length === 0 ? <p className="text-muted-foreground text-sm">공지사항이 없습니다.</p> :
              <ul className="space-y-2">{(notices?.data || []).slice(0, 5).map((p: any) => (
                <li key={p.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <span className="truncate flex-1">{p.isPinned && <span className="text-red-500 mr-1">[필독]</span>}{p.title}</span>
                  <span className="text-muted-foreground text-xs ml-2">{formatDate(p.createdAt)}</span>
                </li>
              ))}</ul>
            }
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">자유게시판</CardTitle>
            <Link href="/board/general"><Button variant="ghost" size="sm">더보기</Button></Link>
          </CardHeader>
          <CardContent>
            {(general?.data || []).length === 0 ? <p className="text-muted-foreground text-sm">게시글이 없습니다.</p> :
              <ul className="space-y-2">{(general?.data || []).slice(0, 5).map((p: any) => (
                <li key={p.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <span className="truncate flex-1">{p.title}</span>
                  <span className="text-muted-foreground text-xs ml-2">{p.author?.name} · {formatDate(p.createdAt)}</span>
                </li>
              ))}</ul>
            }
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

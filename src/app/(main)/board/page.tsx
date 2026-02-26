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
  const { data: notices } = useQuery({
    queryKey: ['board-notices-summary'],
    queryFn: () => api.get('/board/posts?boardCode=NOTICE&pageSize=5') as Promise<any>,
  })
  const { data: general } = useQuery({
    queryKey: ['board-general-summary'],
    queryFn: () => api.get('/board/posts?boardCode=GENERAL&pageSize=5') as Promise<any>,
  })
  const { data: messages } = useQuery({
    queryKey: ['board-messages-summary'],
    queryFn: () => api.get('/board/messages?box=received&pageSize=5') as Promise<any>,
  })

  const unreadCount = (messages?.data || []).filter((m: any) => !m.isRead).length

  return (
    <div className="space-y-6">
      <PageHeader title="게시판" description="공지사항, 자유게시판, 사내메시지를 관리합니다" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">공지사항</CardTitle>
            <div className="bg-muted hidden rounded-md p-1.5 sm:block">
              <Megaphone className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg font-bold sm:text-2xl">{notices?.meta?.totalCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">자유게시판</CardTitle>
            <div className="bg-muted hidden rounded-md p-1.5 sm:block">
              <MessageSquare className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg font-bold sm:text-2xl">{general?.meta?.totalCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">읽지 않은 메시지</CardTitle>
            <div className="bg-status-warning-muted hidden rounded-md p-1.5 sm:block">
              <Mail className="text-status-warning h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className={`text-lg font-bold sm:text-2xl ${unreadCount > 0 ? 'text-status-warning' : ''}`}>
              {unreadCount}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">공지사항</CardTitle>
            <Link href="/board/notices">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {(notices?.data || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">공지사항이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {(notices?.data || []).slice(0, 5).map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between border-b pb-2 text-sm">
                    <span className="flex-1 truncate">
                      {p.isPinned && <span className="mr-1 text-red-500">[필독]</span>}
                      {p.title}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">{formatDate(p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">자유게시판</CardTitle>
            <Link href="/board/general">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {(general?.data || []).length === 0 ? (
              <p className="text-muted-foreground text-sm">게시글이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {(general?.data || []).slice(0, 5).map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between border-b pb-2 text-sm">
                    <span className="flex-1 truncate">{p.title}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {p.author?.name} · {formatDate(p.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

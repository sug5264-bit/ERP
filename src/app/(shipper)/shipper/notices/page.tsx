'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import { Bell } from 'lucide-react'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'

interface Notice {
  id: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  viewCount: number
}

export default function ShipperNoticesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['shipper-notices'],
    queryFn: () => api.get('/board/posts?boardCode=NOTICE&pageSize=30'),
  })

  const notices = (data?.data || []) as Notice[]

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="공지사항" description="물류센터 공지사항을 확인하세요" />

        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><div className="skeleton-shimmer h-6 w-48 mb-2" /><div className="skeleton-shimmer h-4 w-32" /></CardContent></Card>)}
          </div>
        ) : notices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="bg-muted rounded-full p-4"><Bell className="text-muted-foreground h-8 w-8" /></div>
              <p className="text-muted-foreground mt-4 text-sm">공지사항이 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notices.map(n => (
              <Card key={n.id} className="hover:bg-muted/30 cursor-pointer transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {n.isPinned && <Badge variant="destructive" className="text-[10px]">필독</Badge>}
                        <h3 className="truncate font-medium">{n.title}</h3>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{n.content}</p>
                    </div>
                    <div className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(n.createdAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ShipperLayoutShell>
  )
}

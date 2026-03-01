'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function ApprovalPage() {
  const { data: drafts } = useQuery({
    queryKey: ['approval-drafts-summary'],
    queryFn: () => api.get('/approval/documents?filter=myDrafts&pageSize=5'),
  })
  const { data: pending } = useQuery({
    queryKey: ['approval-pending-summary'],
    queryFn: () => api.get('/approval/documents?filter=myApprovals&pageSize=5'),
  })

  const draftCount = drafts?.meta?.totalCount || 0
  const pendingCount = pending?.meta?.totalCount || 0

  return (
    <div className="space-y-6">
      <PageHeader title="전자결재" description="전자결재 문서를 기안하고 관리합니다" />
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">내 기안문서</CardTitle>
            <div className="bg-muted hidden rounded-md p-1.5 sm:block">
              <FileText className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg font-bold sm:text-2xl">{draftCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">결재 대기</CardTitle>
            <div className="bg-status-warning-muted hidden rounded-md p-1.5 sm:block">
              <Clock className="text-status-warning h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className={`text-lg font-bold sm:text-2xl ${pendingCount > 0 ? 'text-status-warning' : ''}`}>
              {pendingCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">결재 완료</CardTitle>
            <div className="bg-status-success-muted hidden rounded-md p-1.5 sm:block">
              <CheckCircle className="text-status-success h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-status-success text-lg font-bold sm:text-2xl">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">반려</CardTitle>
            <div className="bg-status-danger-muted hidden rounded-md p-1.5 sm:block">
              <XCircle className="text-status-danger h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-status-danger text-lg font-bold sm:text-2xl">-</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">내 기안문서</CardTitle>
            <Link href="/approval/draft">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {(drafts?.data || []).length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground text-sm">기안 문서가 없습니다.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {(drafts?.data || []).map(
                  (d: { id: string; title: string; status: string; drafter?: { nameKo: string } }) => (
                    <li key={d.id} className="flex items-center justify-between border-b pb-2 text-sm">
                      <span>{d.title}</span>
                      <span className="text-muted-foreground">{d.status}</span>
                    </li>
                  )
                )}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">결재 대기</CardTitle>
            <Link href="/approval/pending">
              <Button variant="ghost" size="sm" className="hover:text-primary text-xs">
                더보기 &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {(pending?.data || []).length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground text-sm">결재 대기 문서가 없습니다.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {(pending?.data || []).map(
                  (d: { id: string; title: string; status: string; drafter?: { nameKo: string } }) => (
                    <li key={d.id} className="flex items-center justify-between border-b pb-2 text-sm">
                      <span>{d.title}</span>
                      <span className="text-muted-foreground">{d.drafter?.nameKo}</span>
                    </li>
                  )
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

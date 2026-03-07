'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { ShieldCheck } from 'lucide-react'

export default function QualityStandardsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="검사기준"
        description="품질 검사 기준을 등록하고 관리합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <ShieldCheck className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">검사기준 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}

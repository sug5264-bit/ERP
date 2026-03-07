'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardCheck } from 'lucide-react'

export default function ProductionResultPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="생산실적"
        description="생산 실적을 기록하고 조회합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <ClipboardCheck className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">생산실적 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}

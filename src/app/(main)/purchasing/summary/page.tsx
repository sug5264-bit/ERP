'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function PurchasingSummaryPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="매입현황"
        description="매입 현황을 조회하고 분석합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <BarChart3 className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">매입현황 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}

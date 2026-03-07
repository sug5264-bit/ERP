'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { ScanBarcode } from 'lucide-react'

export default function LotTrackingPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="LOT추적"
        description="제품의 LOT 번호를 기반으로 이력을 추적합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <ScanBarcode className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">LOT추적 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}

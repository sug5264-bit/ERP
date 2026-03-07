'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { BadgeDollarSign } from 'lucide-react'

export default function PricingPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="단가관리"
        description="거래처별 품목 단가를 등록하고 관리합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <BadgeDollarSign className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">단가관리 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}

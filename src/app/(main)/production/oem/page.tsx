'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Factory } from 'lucide-react'

export default function OemPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="OEM 위탁현황"
        description="OEM 위탁 생산 현황을 조회하고 관리합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <Factory className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">OEM 위탁현황 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}

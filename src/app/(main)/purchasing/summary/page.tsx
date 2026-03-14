'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function PurchaseSummaryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="매입현황" description="매입 현황을 조회하고 분석합니다." />
      <ComingSoon title="매입현황" />
    </div>
  )
}

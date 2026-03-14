'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function ProductionResultPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="생산실적" description="생산 실적을 기록하고 조회합니다." />
      <ComingSoon title="생산실적" />
    </div>
  )
}

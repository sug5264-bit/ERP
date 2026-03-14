'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function ProductionPlanPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="생산계획" description="생산 계획을 수립하고 관리합니다." />
      <ComingSoon title="생산계획" />
    </div>
  )
}

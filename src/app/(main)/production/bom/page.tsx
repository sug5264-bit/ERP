'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function BomPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="배합표(BOM)" description="제품 배합표를 등록하고 관리합니다." />
      <ComingSoon title="배합표(BOM)" />
    </div>
  )
}

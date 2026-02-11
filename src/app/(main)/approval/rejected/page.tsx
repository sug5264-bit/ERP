import { PageHeader } from '@/components/common/page-header'

export default function RejectedPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="반려문서"
        description="반려된 문서 목록입니다"
        createHref="/approval/rejected/new"
        createLabel="신규"
      />
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        데이터 테이블이 표시됩니다.
      </div>
    </div>
  )
}

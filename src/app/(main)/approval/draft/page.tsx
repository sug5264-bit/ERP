import { PageHeader } from '@/components/common/page-header'

export default function DraftPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="기안하기"
        description="새로운 결재 문서를 작성합니다"
        createHref="/approval/draft/new"
        createLabel="신규"
      />
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        데이터 테이블이 표시됩니다.
      </div>
    </div>
  )
}

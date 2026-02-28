import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="px-4 text-center">
        <h1 className="text-muted-foreground/30 mb-4 text-6xl font-bold">404</h1>
        <h2 className="mb-2 text-xl font-semibold">페이지를 찾을 수 없습니다</h2>
        <p className="text-muted-foreground mb-6 text-sm">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
        <Link
          href="/dashboard"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  )
}

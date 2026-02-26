function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`bg-muted animate-pulse rounded-md ${className || ''}`} style={style} />
}

export default function MainLoading() {
  return (
    <div className="animate-fade-in-up space-y-4 sm:space-y-6">
      {/* Page header skeleton */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2 sm:gap-3">
        <Skeleton className="h-9 w-full rounded-md sm:w-64" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="hidden h-9 w-28 rounded-md sm:block" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        {/* Header */}
        <div className="bg-muted/30 border-b px-3 py-3 sm:px-4">
          <div className="flex gap-6">
            {[80, 120, 100, 80, 60].map((w, i) => (
              <Skeleton key={i} className="h-4" style={{ width: w }} />
            ))}
          </div>
        </div>
        {/* Rows */}
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-3 py-3 sm:px-4">
              {[70, 110, 90, 70, 50].map((w, j) => (
                <Skeleton key={j} className="h-4" style={{ width: w + ((i * 7 + j * 13) % 30) }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

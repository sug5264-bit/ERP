import { Card, CardContent, CardHeader } from '@/components/ui/card'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className || ''}`} />
}

export default function MainLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header skeleton */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2 sm:gap-4">
        <Skeleton className="h-9 w-full sm:w-72" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader className="p-3 sm:p-6 pb-0 sm:pb-0">
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

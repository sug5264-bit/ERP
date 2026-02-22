import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

interface PageHeaderProps {
  title: string
  description?: string
  createHref?: string
  createLabel?: string
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  createHref,
  createLabel = '신규',
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-[13px] sm:text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {createHref && (
          <Button size="sm" asChild className="sm:size-default">
            <Link href={createHref}>
              <Plus className="mr-1.5 h-4 w-4" />
              {createLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}

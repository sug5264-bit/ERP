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

export function PageHeader({ title, description, createHref, createLabel = '신규', actions }: PageHeaderProps) {
  return (
    <div className="animate-fade-in-up flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="text-muted-foreground mt-0.5 text-[13px] sm:text-sm">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {createHref && (
          <Button size="sm" asChild className="sm:size-default shadow-sm">
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

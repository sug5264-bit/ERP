'use client'

import { Construction } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description?: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="bg-muted rounded-full p-4">
        <Construction className="text-muted-foreground h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">
          {description || '해당 기능은 현재 준비 중입니다. 빠른 시일 내에 제공될 예정입니다.'}
        </p>
      </div>
    </div>
  )
}

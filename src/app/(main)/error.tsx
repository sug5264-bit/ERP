'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-lg">오류가 발생했습니다</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            페이지를 불러오는 중 문제가 발생했습니다.
            {error.digest && (
              <span className="block text-xs mt-1 font-mono">
                오류 코드: {error.digest}
              </span>
            )}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={reset} variant="default" size="sm">
              <RefreshCw className="mr-1.5 h-4 w-4" />
              다시 시도
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <Home className="mr-1.5 h-4 w-4" />
                대시보드
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

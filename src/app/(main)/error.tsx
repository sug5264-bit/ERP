'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react'
import Link from 'next/link'

export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // 프로덕션 에러 리포팅 (구조화 로그)
    console.error(
      JSON.stringify({
        type: 'CLIENT_ERROR',
        message: error.message,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.href : '',
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      })
    )
  }, [error])

  const errorInfo = [
    `시간: ${new Date().toLocaleString('ko-KR')}`,
    `페이지: ${typeof window !== 'undefined' ? window.location.pathname : ''}`,
    error.digest ? `코드: ${error.digest}` : '',
    `메시지: ${error.message}`,
  ]
    .filter(Boolean)
    .join('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorInfo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API 미지원 시 무시
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-destructive/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
            <AlertTriangle className="text-destructive h-6 w-6" />
          </div>
          <CardTitle className="text-lg">오류가 발생했습니다</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center text-sm">
            페이지를 불러오는 중 문제가 발생했습니다.
            {error.digest && <span className="mt-1 block font-mono text-xs">오류 코드: {error.digest}</span>}
          </p>
          <div className="flex justify-center gap-2">
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
            <Button onClick={handleCopy} variant="ghost" size="sm" title="오류 정보 복사">
              {copied ? <Check className="mr-1.5 h-4 w-4 text-green-500" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? '복사됨' : '복사'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

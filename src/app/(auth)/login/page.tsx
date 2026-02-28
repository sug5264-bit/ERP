'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_NAME, COMPANY_NAME } from '@/lib/constants'
import { AlertCircle, Eye, EyeOff, Loader2, Shield, Lock } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCallback = searchParams.get('callbackUrl') || '/dashboard'
  // 오픈 리다이렉트 방지: 내부 경로만 허용
  const callbackUrl = rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/dashboard'
  const sessionExpired = searchParams.get('error') === 'session_expired'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(sessionExpired ? '세션이 만료되었습니다. 다시 로그인해주세요.' : '')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        if (result.error === 'CredentialsSignin') {
          setError('아이디 또는 비밀번호가 올바르지 않습니다.')
        } else if (result.error === 'Configuration') {
          setError('서버 설정 오류가 발생했습니다. 관리자에게 문의하세요.')
        } else {
          setError(`로그인 실패: ${result.error}`)
        }
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      } else {
        setError('로그인 응답을 처리할 수 없습니다.')
      }
    } catch (err) {
      console.error('[Login] Error:', err)
      setError('로그인 중 오류가 발생했습니다. 네트워크를 확인하세요.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="animate-scale-in w-full max-w-md px-4">
      <Card className="border-0 shadow-xl sm:border">
        <CardHeader className="space-y-3 pb-2 text-center">
          <div className="bg-primary text-primary-foreground mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg">
            <Shield className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">{APP_NAME}</CardTitle>
            <CardDescription className="mt-1">계정에 로그인하여 시작하세요</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="animate-scale-in bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg p-3 text-sm"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">아이디</Label>
              <Input
                id="username"
                type="text"
                placeholder="사용자 아이디를 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
                autoFocus
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  aria-required="true"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground absolute top-0 right-0 flex h-full w-10 items-center justify-center transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="mt-6 text-center">
        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
          <Lock className="h-3 w-3" />
          보안 접속 중 &middot; {COMPANY_NAME}
        </p>
        <p className="text-muted-foreground/60 mt-1 text-[11px]">무단 접근 시 법적 조치가 취해질 수 있습니다</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="loading-spinner" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

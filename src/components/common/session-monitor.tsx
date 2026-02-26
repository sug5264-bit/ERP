'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Clock } from 'lucide-react'

const SESSION_MAX_AGE = 8 * 60 * 60 * 1000 // 8시간 (ms)
const WARNING_THRESHOLD = 10 * 60 * 1000 // 만료 10분 전 경고
const CHECK_INTERVAL = 60 * 1000 // 1분마다 체크

/**
 * 세션 만료 경고 모니터
 * - JWT 토큰 만료 10분 전에 경고 다이얼로그 표시
 * - 연장 또는 로그아웃 선택 가능
 */
export function SessionMonitor() {
  const { data: session, update } = useSession()
  const [showWarning, setShowWarning] = useState(false)
  const [remainingMs, setRemainingMs] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningShownRef = useRef(false)

  const getExpiryTime = useCallback(() => {
    if (!session) return null
    // NextAuth JWT의 exp를 추정: 마지막 갱신 시점 + maxAge
    // session.expires는 ISO string
    if ((session as any).expires && typeof (session as any).expires === 'string') {
      const expiryTime = new Date((session as any).expires).getTime()
      if (!isNaN(expiryTime)) return expiryTime
    }
    return null
  }, [session])

  useEffect(() => {
    if (!session) return

    const check = () => {
      const expiry = getExpiryTime()
      if (!expiry) return

      const now = Date.now()
      const remaining = expiry - now

      setRemainingMs(Math.max(0, remaining))

      if (remaining <= 0) {
        // 이미 만료됨
        signOut({ callbackUrl: '/login' })
        return
      }

      if (remaining <= WARNING_THRESHOLD && !warningShownRef.current) {
        warningShownRef.current = true
        setShowWarning(true)
      }
    }

    check()
    intervalRef.current = setInterval(check, CHECK_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session, getExpiryTime])

  // 카운트다운 업데이트 (경고 표시 중)
  useEffect(() => {
    if (!showWarning) return

    const countdown = setInterval(() => {
      const expiry = getExpiryTime()
      if (!expiry) return
      const remaining = expiry - Date.now()
      setRemainingMs(Math.max(0, remaining))

      if (remaining <= 0) {
        signOut({ callbackUrl: '/login' })
      }
    }, 1000)

    return () => clearInterval(countdown)
  }, [showWarning, getExpiryTime])

  const handleExtend = useCallback(async () => {
    // 세션 갱신 요청
    await update()
    warningShownRef.current = false
    setShowWarning(false)
  }, [update])

  const handleLogout = useCallback(() => {
    signOut({ callbackUrl: '/login' })
  }, [])

  const formatRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`
  }

  const progress = Math.max(0, Math.min(100, (remainingMs / WARNING_THRESHOLD) * 100))

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            세션 만료 경고
          </DialogTitle>
          <DialogDescription>세션이 곧 만료됩니다. 작업을 계속하시려면 세션을 연장해주세요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-center">
            <span className="text-2xl font-bold text-amber-600 tabular-nums dark:text-amber-400">
              {formatRemaining(remainingMs)}
            </span>
            <p className="text-muted-foreground mt-1 text-sm">후 자동 로그아웃</p>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleLogout}>
            로그아웃
          </Button>
          <Button onClick={handleExtend}>세션 연장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { PermissionError, RateLimitError, ApiError } from '@/hooks/use-api'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5분 (참조 데이터 캐시 효과 향상)
            gcTime: 10 * 60 * 1000, // 10분 (가비지 컬렉션)
            retry: (failureCount, error) => {
              // 인증/권한/Rate Limit 에러는 재시도 불필요
              if (error instanceof PermissionError) return false
              if (error instanceof RateLimitError) return false
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
              if (error instanceof Error) {
                const msg = error.message
                if (msg.includes('세션') || msg.includes('권한') || msg.includes('인증')) return false
              }
              return failureCount < 2
            },
            retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always',
          },
          mutations: {
            retry: false,
            onError: (error) => {
              if (error instanceof RateLimitError) {
                toast.error('요청이 너무 많습니다', {
                  description: '잠시 후 다시 시도해주세요.',
                })
                return
              }
              if (error instanceof PermissionError) {
                toast.error('권한 없음', {
                  description: error.message,
                })
                return
              }
              if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
                toast.error('입력값 오류', {
                  description: error.message,
                })
                return
              }
              const message = error instanceof Error ? error.message : '요청 처리 중 오류가 발생했습니다.'
              toast.error(message)
            },
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

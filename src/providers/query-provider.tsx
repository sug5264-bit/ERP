'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5분 (참조 데이터 캐시 효과 향상)
            gcTime: 10 * 60 * 1000, // 10분 (가비지 컬렉션)
            retry: (failureCount, error) => {
              // 401/403 에러는 재시도 불필요
              if (error instanceof Error) {
                const msg = error.message
                if (msg.includes('세션') || msg.includes('권한') || msg.includes('인증')) return false
              }
              return failureCount < 2
            },
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: false,
            onError: (error) => {
              const message = error instanceof Error ? error.message : '요청 처리 중 오류가 발생했습니다.'
              toast.error(message)
            },
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

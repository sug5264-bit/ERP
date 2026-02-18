'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Shortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  description: string
  action: () => void
}

/**
 * 글로벌 키보드 단축키 목록
 */
export const SHORTCUT_LIST = [
  { keys: 'Ctrl+K', description: '통합 검색' },
  { keys: 'Alt+N', description: '새 항목 생성 (페이지별)' },
  { keys: 'Alt+S', description: '저장 (폼 페이지)' },
  { keys: 'Alt+D', description: '대시보드로 이동' },
  { keys: 'Alt+1', description: '회계 모듈' },
  { keys: 'Alt+2', description: '인사 모듈' },
  { keys: 'Alt+3', description: '재고 모듈' },
  { keys: 'Alt+4', description: '판매 모듈' },
  { keys: 'Alt+5', description: '전자결재' },
  { keys: 'Escape', description: '다이얼로그/모달 닫기' },
  { keys: '?', description: '단축키 도움말 (Shift+/)' },
]

/**
 * 글로벌 키보드 단축키 훅
 * - 메인 레이아웃에서 한 번 등록
 * - input/textarea 포커스 시 무시
 */
export function useKeyboardShortcuts(
  onToggleHelp?: () => void,
  onNew?: () => void,
  onSave?: () => void,
) {
  const router = useRouter()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable

      // Ctrl+K: 통합 검색 (header에서 이미 처리하므로 여기선 스킵)
      // 단, input 안에서도 작동하도록 header에서 처리

      // Alt 단축키: input 안에서도 동작
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault()
            router.push('/dashboard')
            return
          case '1':
            e.preventDefault()
            router.push('/accounting/vouchers')
            return
          case '2':
            e.preventDefault()
            router.push('/hr/employees')
            return
          case '3':
            e.preventDefault()
            router.push('/inventory/items')
            return
          case '4':
            e.preventDefault()
            router.push('/sales/orders')
            return
          case '5':
            e.preventDefault()
            router.push('/approval/pending')
            return
          case 'n':
            e.preventDefault()
            onNew?.()
            return
          case 's':
            e.preventDefault()
            onSave?.()
            return
        }
      }

      // input 안에서는 나머지 단축키 무시
      if (isInput) return

      // ? (Shift+/) : 단축키 도움말
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        onToggleHelp?.()
      }
    },
    [router, onToggleHelp, onNew, onSave]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

'use client'

import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-status-danger-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <AlertTriangle className="text-status-danger h-8 w-8" />
          </div>
          <h3 className="text-lg font-medium">오류가 발생했습니다</h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            {this.state.error?.message || '페이지를 불러오는 중 문제가 발생했습니다.'}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            variant="outline"
            className="mt-4"
            size="sm"
          >
            다시 시도
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

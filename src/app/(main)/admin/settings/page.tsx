'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Upload, Trash2, FileType, CheckCircle } from 'lucide-react'

interface FontFile {
  name: string
  size: number
  modifiedAt: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data: fontsData, isLoading } = useQuery({
    queryKey: ['admin-fonts'],
    queryFn: () => api.get('/admin/fonts') as Promise<{ data: FontFile[] }>,
  })

  const fonts = fontsData?.data || []

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/v1/admin/fonts', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err?.error?.message || '업로드 실패')
        }
        toast.success('폰트가 업로드되었습니다.')
        queryClient.invalidateQueries({ queryKey: ['admin-fonts'] })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '업로드 실패')
      } finally {
        setUploading(false)
      }
    },
    [queryClient]
  )

  const handleDelete = useCallback(
    async (name: string) => {
      if (!confirm(`[${name}] 폰트를 삭제하시겠습니까?`)) return
      try {
        const res = await fetch(`/api/v1/admin/fonts?name=${encodeURIComponent(name)}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err?.error?.message || '삭제 실패')
        }
        toast.success('폰트가 삭제되었습니다.')
        queryClient.invalidateQueries({ queryKey: ['admin-fonts'] })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '삭제 실패')
      }
    },
    [queryClient]
  )

  const hasPretendard = fonts.some((f) => f.name.toLowerCase().includes('pretendard'))

  return (
    <div className="space-y-6">
      <PageHeader title="시스템 설정" description="PDF 출력용 한글 폰트 관리 및 시스템 설정을 관리합니다." />

      {/* 폰트 관리 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileType className="h-5 w-5" />
              PDF 한글 폰트 관리
            </CardTitle>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-1.5 h-4 w-4" />
              {uploading ? '업로드 중...' : '폰트 업로드'}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            PDF 문서 출력 시 사용할 한글 폰트(.ttf, .otf)를 업로드합니다. PretendardVariable.ttf를 권장합니다.
          </p>
        </CardHeader>
        <CardContent>
          {hasPretendard && (
            <div className="bg-status-success-muted mb-4 flex items-center gap-2 rounded-lg border p-3">
              <CheckCircle className="text-status-success h-4 w-4" />
              <span className="text-sm">Pretendard 폰트가 설치되어 있습니다. PDF 한글 출력이 정상 동작합니다.</span>
            </div>
          )}
          {!hasPretendard && fonts.length === 0 && !isLoading && (
            <div className="bg-status-warning-muted rounded-lg border p-3">
              <p className="text-sm">
                한글 폰트가 설치되어 있지 않습니다. PDF 출력 시 CDN 폰트를 사용하며, 로딩이 느릴 수 있습니다.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                PretendardVariable.ttf 파일을 업로드하면 빠르고 깨끗한 한글 출력이 가능합니다.
              </p>
            </div>
          )}

          {fonts.length > 0 && (
            <div className="space-y-2">
              {fonts.map((font) => (
                <div key={font.name} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <FileType className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="text-sm font-medium">{font.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatFileSize(font.size)}
                        {font.name.toLowerCase().includes('pretendard') && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            추천
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => handleDelete(font.name)}
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {isLoading && <p className="text-muted-foreground text-center text-sm">로딩 중...</p>}
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

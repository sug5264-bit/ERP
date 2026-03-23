'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Pencil, Trash2, Upload, X, FileText, Image, Building2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface CompanyRow {
  id: string
  companyName: string
  bizNo: string | null
  ceoName: string | null
  bizType: string | null
  bizCategory: string | null
  address: string | null
  phone: string | null
  fax: string | null
  email: string | null
  bankName: string | null
  bankAccount: string | null
  bankHolder: string | null
  logoPath: string | null
  sealPath: string | null
  bizCertPath: string | null
  bankCopyPath: string | null
  isDefault: boolean
}

type UploadField = 'logoPath' | 'sealPath' | 'bizCertPath' | 'bankCopyPath'

const FILE_FIELDS: { field: UploadField; label: string; accept: string; icon: typeof Image }[] = [
  {
    field: 'logoPath',
    label: '회사 로고',
    accept: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml',
    icon: Building2,
  },
  { field: 'sealPath', label: '법인 인감', accept: 'image/png,image/jpeg,image/gif,image/webp', icon: Image },
  { field: 'bizCertPath', label: '사업자등록증', accept: 'image/png,image/jpeg,application/pdf', icon: FileText },
  { field: 'bankCopyPath', label: '통장사본', accept: 'image/png,image/jpeg,application/pdf', icon: FileText },
]

function getFileUrl(filename: string) {
  return `/api/v1/admin/company/file/${filename}`
}

function FileUploadCard({
  companyId,
  field,
  label,
  accept,
  currentPath,
  icon: Icon,
  onUploaded,
}: {
  companyId: string
  field: UploadField
  label: string
  accept: string
  currentPath: string | null
  icon: typeof Image
  onUploaded: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('field', field)
        const res = await fetch(`/api/v1/admin/company/${companyId}/upload`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err?.error?.message || '업로드 실패')
        }
        toast.success(`${label} 업로드 완료`)
        onUploaded()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '업로드 실패')
      } finally {
        setUploading(false)
      }
    },
    [companyId, field, label, onUploaded]
  )

  const handleDelete = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/company/${companyId}/upload?field=${field}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('삭제 실패')
      toast.success(`${label} 삭제 완료`)
      onUploaded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제 실패')
    }
  }, [companyId, field, label, onUploaded])

  const isImage = accept.startsWith('image') || accept.includes('image')
  const isPdf = currentPath?.endsWith('.pdf')

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentPath ? (
          <div className="space-y-2">
            {isImage && !isPdf ? (
              <div className="flex h-24 items-center justify-center overflow-hidden rounded border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getFileUrl(currentPath)} alt={label} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded border bg-white">
                <a
                  href={getFileUrl(currentPath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm underline"
                >
                  파일 보기
                </a>
              </div>
            )}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-1 h-3 w-3" />
                변경
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive text-xs"
                onClick={handleDelete}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="border-muted-foreground/30 hover:border-primary hover:bg-muted/50 flex h-24 w-full flex-col items-center justify-center gap-1 rounded border-2 border-dashed transition-colors"
          >
            <Upload className="text-muted-foreground h-5 w-5" />
            <span className="text-muted-foreground text-xs">{uploading ? '업로드 중...' : '클릭하여 업로드'}</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
            e.target.value = ''
          }}
        />
      </CardContent>
    </Card>
  )
}

function CompanyForm({
  onSubmit,
  defaults,
  isPending,
  submitLabel,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  defaults?: CompanyRow | null
  isPending: boolean
  submitLabel: string
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            회사명 <span className="text-destructive">*</span>
          </Label>
          <Input name="companyName" required aria-required="true" defaultValue={defaults?.companyName || ''} />
        </div>
        <div className="space-y-2">
          <Label>사업자등록번호</Label>
          <Input name="bizNo" placeholder="000-00-00000" defaultValue={defaults?.bizNo || ''} />
        </div>
        <div className="space-y-2">
          <Label>대표자</Label>
          <Input name="ceoName" defaultValue={defaults?.ceoName || ''} />
        </div>
        <div className="space-y-2">
          <Label>업태</Label>
          <Input name="bizType" defaultValue={defaults?.bizType || ''} />
        </div>
        <div className="space-y-2">
          <Label>업종</Label>
          <Input name="bizCategory" defaultValue={defaults?.bizCategory || ''} />
        </div>
        <div className="space-y-2">
          <Label>전화번호</Label>
          <Input name="phone" defaultValue={defaults?.phone || ''} />
        </div>
        <div className="space-y-2">
          <Label>팩스</Label>
          <Input name="fax" defaultValue={defaults?.fax || ''} />
        </div>
        <div className="space-y-2">
          <Label>이메일</Label>
          <Input name="email" type="email" defaultValue={defaults?.email || ''} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>주소</Label>
          <Input name="address" defaultValue={defaults?.address || ''} />
        </div>
        <div className="space-y-2">
          <Label>은행명</Label>
          <Input name="bankName" defaultValue={defaults?.bankName || ''} />
        </div>
        <div className="space-y-2">
          <Label>계좌번호</Label>
          <Input name="bankAccount" defaultValue={defaults?.bankAccount || ''} />
        </div>
        <div className="space-y-2">
          <Label>예금주</Label>
          <Input name="bankHolder" defaultValue={defaults?.bankHolder || ''} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            name="isDefault"
            id="isDefault"
            defaultChecked={defaults?.isDefault || false}
            className="h-4 w-4"
          />
          <Label htmlFor="isDefault">기본 회사로 설정</Label>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? '처리 중...' : submitLabel}
      </Button>
    </form>
  )
}

export default function CompanyManagementPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CompanyRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [fileTarget, setFileTarget] = useState<CompanyRow | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api.get('/admin/company') as Promise<{ data: CompanyRow[] }>,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/admin/company', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      setCreateOpen(false)
      toast.success('회사 정보가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/admin/company/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      setEditTarget(null)
      toast.success('회사 정보가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/company/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      setDeleteTarget(null)
      toast.success('회사 정보가 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      companyName: form.get('companyName'),
      bizNo: form.get('bizNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      bizType: form.get('bizType') || undefined,
      bizCategory: form.get('bizCategory') || undefined,
      address: form.get('address') || undefined,
      phone: form.get('phone') || undefined,
      fax: form.get('fax') || undefined,
      email: form.get('email') || undefined,
      bankName: form.get('bankName') || undefined,
      bankAccount: form.get('bankAccount') || undefined,
      bankHolder: form.get('bankHolder') || undefined,
      isDefault: form.get('isDefault') === 'on',
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      companyName: form.get('companyName'),
      bizNo: form.get('bizNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      bizType: form.get('bizType') || undefined,
      bizCategory: form.get('bizCategory') || undefined,
      address: form.get('address') || undefined,
      phone: form.get('phone') || undefined,
      fax: form.get('fax') || undefined,
      email: form.get('email') || undefined,
      bankName: form.get('bankName') || undefined,
      bankAccount: form.get('bankAccount') || undefined,
      bankHolder: form.get('bankHolder') || undefined,
      isDefault: form.get('isDefault') === 'on',
    })
  }

  const handleFilesRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
    // Refresh fileTarget data
    if (fileTarget) {
      api
        .get('/admin/company')
        .then((res: unknown) => {
          const data = (res as { data?: CompanyRow[] }).data || []
          const updated = data.find((c) => c.id === fileTarget.id)
          if (updated) setFileTarget(updated)
        })
        .catch(() => {})
    }
  }, [queryClient, fileTarget])

  const companies: CompanyRow[] = data?.data || []

  const columns: ColumnDef<CompanyRow>[] = [
    {
      accessorKey: 'companyName',
      header: '회사명',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.companyName}</span>
          {row.original.isDefault && <Badge variant="default">기본</Badge>}
        </div>
      ),
    },
    { accessorKey: 'bizNo', header: '사업자등록번호', cell: ({ row }) => row.original.bizNo || '-' },
    { accessorKey: 'ceoName', header: '대표자', cell: ({ row }) => row.original.ceoName || '-' },
    { accessorKey: 'phone', header: '전화번호', cell: ({ row }) => row.original.phone || '-' },
    { accessorKey: 'bankName', header: '은행', cell: ({ row }) => row.original.bankName || '-' },
    { accessorKey: 'bankAccount', header: '계좌번호', cell: ({ row }) => row.original.bankAccount || '-' },
    {
      id: 'files',
      header: '첨부파일',
      cell: ({ row }) => {
        const r = row.original
        const count = [r.logoPath, r.sealPath, r.bizCertPath, r.bankCopyPath].filter(Boolean).length
        return (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={(e) => {
              e.stopPropagation()
              setFileTarget(r)
            }}
          >
            <Upload className="mr-1 h-3 w-3" />
            {count > 0 ? `${count}개` : '없음'}
          </Button>
        )
      },
      size: 100,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setEditTarget(row.original)}
            aria-label="수정"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive h-8 w-8"
            onClick={() => setDeleteTarget({ id: row.original.id, name: row.original.companyName })}
            aria-label="삭제"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      size: 80,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="회사관리"
        description="회사 정보를 등록하고 관리합니다. 로고, 인감, 사업자등록증 등의 파일을 업로드할 수 있습니다."
      />
      <div className="flex items-center gap-4">
        <Button onClick={() => setCreateOpen(true)}>회사 등록</Button>
      </div>
      <DataTable
        columns={columns}
        data={companies}
        searchColumn="companyName"
        searchPlaceholder="회사명으로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
      />

      {/* 회사 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>회사 등록</DialogTitle>
          </DialogHeader>
          <CompanyForm onSubmit={handleCreate} isPending={createMutation.isPending} submitLabel="등록" />
        </DialogContent>
      </Dialog>

      {/* 회사 수정 다이얼로그 */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>회사 정보 수정</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <CompanyForm
              key={editTarget.id}
              onSubmit={handleUpdate}
              defaults={editTarget}
              isPending={updateMutation.isPending}
              submitLabel="수정"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 파일 관리 다이얼로그 */}
      <Dialog open={!!fileTarget} onOpenChange={(v) => !v && setFileTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{fileTarget?.companyName} - 파일 관리</DialogTitle>
          </DialogHeader>
          {fileTarget && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FILE_FIELDS.map(({ field, label, accept, icon }) => (
                <FileUploadCard
                  key={field}
                  companyId={fileTarget.id}
                  field={field}
                  label={label}
                  accept={accept}
                  currentPath={fileTarget[field]}
                  icon={icon}
                  onUploaded={handleFilesRefresh}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="회사 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까?`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}

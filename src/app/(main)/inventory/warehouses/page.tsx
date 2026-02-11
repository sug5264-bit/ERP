'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, MapPin, Trash2 } from 'lucide-react'

interface WarehouseRow {
  id: string; code: string; name: string; location: string | null; isActive: boolean
  zones: { id: string; zoneCode: string; zoneName: string }[]
  _count: { stockBalances: number }
}

export default function WarehousesPage() {
  const [open, setOpen] = useState(false)
  const [zoneDialogId, setZoneDialogId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-warehouses'],
    queryFn: () => api.get('/inventory/warehouses') as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/inventory/warehouses', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
      setOpen(false)
      toast.success('창고가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const createZoneMutation = useMutation({
    mutationFn: ({ warehouseId, ...body }: any) =>
      api.post(`/inventory/warehouses/${warehouseId}/zones`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
      setZoneDialogId(null)
      toast.success('구역이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
      toast.success('창고가 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (wh: WarehouseRow) => {
    if (!confirm(`"${wh.name}" 창고를 삭제하시겠습니까?`)) return
    deleteMutation.mutate(wh.id)
  }

  const warehouses: WarehouseRow[] = data?.data || []

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      code: form.get('code'),
      name: form.get('name'),
      location: form.get('location') || undefined,
    })
  }

  const handleCreateZone = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createZoneMutation.mutate({
      warehouseId: zoneDialogId,
      zoneCode: form.get('zoneCode'),
      zoneName: form.get('zoneName'),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="창고관리" description="창고 정보를 등록하고 관리합니다" />
      <div className="flex items-center gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>창고 등록</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>창고 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>창고코드 *</Label><Input name="code" required placeholder="WH-01" /></div>
              <div className="space-y-2"><Label>창고명 *</Label><Input name="name" required /></div>
              <div className="space-y-2"><Label>위치</Label><Input name="location" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '창고 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">로딩 중...</p>
      ) : warehouses.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">등록된 창고가 없습니다.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((wh) => (
            <Card key={wh.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{wh.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={wh.isActive ? 'default' : 'secondary'}>
                      {wh.isActive ? '활성' : '비활성'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(wh)}
                      disabled={deleteMutation.isPending}
                      title="창고 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{wh.code}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {wh.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {wh.location}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  재고 품목: {wh._count.stockBalances}건
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">구역 ({wh.zones.length})</span>
                    <Dialog open={zoneDialogId === wh.id} onOpenChange={(v) => setZoneDialogId(v ? wh.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm"><Plus className="mr-1 h-3 w-3" /> 구역추가</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{wh.name} - 구역 추가</DialogTitle></DialogHeader>
                        <form onSubmit={handleCreateZone} className="space-y-4">
                          <div className="space-y-2"><Label>구역코드 *</Label><Input name="zoneCode" required placeholder="A-01" /></div>
                          <div className="space-y-2"><Label>구역명 *</Label><Input name="zoneName" required /></div>
                          <Button type="submit" className="w-full" disabled={createZoneMutation.isPending}>
                            {createZoneMutation.isPending ? '등록 중...' : '구역 추가'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {wh.zones.length > 0 && (
                    <div className="rounded border divide-y">
                      {wh.zones.map((zone) => (
                        <div key={zone.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                          <span className="font-mono text-xs">{zone.zoneCode}</span>
                          <span>{zone.zoneName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

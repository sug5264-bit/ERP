'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExcelImportDialog } from '@/components/common/excel-import-dialog'
import type { TemplateColumn } from '@/lib/export'
import { SHIPPING_METHOD_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Upload } from 'lucide-react'
import Link from 'next/link'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'

const templateColumns: TemplateColumn[] = [
  { header: '수취인명*', key: 'recipientName', required: true, example: '홍길동' },
  { header: '수취인 연락처', key: 'recipientPhone', example: '010-1234-5678' },
  { header: '수취인 우편번호', key: 'recipientZipCode', example: '06234' },
  { header: '수취인 주소*', key: 'recipientAddress', required: true, example: '서울시 강남구 역삼동 123' },
  { header: '상품명*', key: 'itemName', required: true, example: '건강식품 세트' },
  { header: '수량', key: 'quantity', example: '1' },
  { header: '중량(kg)', key: 'weight', example: '2.5' },
  { header: '배송방법', key: 'shippingMethod', example: 'NORMAL' },
  { header: '특이사항', key: 'specialNote', example: '부재시 경비실' },
  { header: '발송인명', key: 'senderName', example: '(주)웰그린' },
  { header: '발송인 연락처', key: 'senderPhone', example: '02-1234-5678' },
  { header: '발송인 주소', key: 'senderAddress', example: '서울시 서초구' },
]

const keyMap: Record<string, string> = {
  수취인명: 'recipientName',
  '수취인 연락처': 'recipientPhone',
  '수취인 우편번호': 'recipientZipCode',
  '수취인 주소': 'recipientAddress',
  상품명: 'itemName',
  수량: 'quantity',
  '중량(kg)': 'weight',
  배송방법: 'shippingMethod',
  특이사항: 'specialNote',
  발송인명: 'senderName',
  '발송인 연락처': 'senderPhone',
  '발송인 주소': 'senderAddress',
}

export default function ShipperNewOrderPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [excelDialogOpen, setExcelDialogOpen] = useState(false)
  const [form, setForm] = useState({
    senderName: '',
    senderPhone: '',
    senderAddress: '',
    recipientName: '',
    recipientPhone: '',
    recipientZipCode: '',
    recipientAddress: '',
    itemName: '',
    quantity: 1,
    weight: '',
    shippingMethod: 'NORMAL',
    specialNote: '',
  })

  const updateField = (field: string, value: string | number) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.recipientName || !form.recipientAddress || !form.itemName) {
      toast.error('필수 항목을 입력해주세요')
      return
    }
    setIsSubmitting(true)
    try {
      await api.post('/shipper/orders', {
        ...form,
        quantity: Number(form.quantity),
        weight: form.weight ? Number(form.weight) : null,
      })
      toast.success('주문이 등록되었습니다')
      router.push('/shipper/orders')
    } catch {
      toast.error('주문 등록에 실패했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="주문등록"
          description="새로운 배송 주문을 등록합니다"
          actions={
            <Link href="/shipper/orders">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> 목록
              </Button>
            </Link>
          }
        />

        <Tabs defaultValue="manual" className="w-full">
          <TabsList>
            <TabsTrigger value="manual">수기등록</TabsTrigger>
            <TabsTrigger value="excel">엑셀 업로드</TabsTrigger>
          </TabsList>

          {/* 수기등록 탭 */}
          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 발송인 */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">발송인 정보</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">이름</Label>
                    <Input
                      value={form.senderName}
                      onChange={(e) => updateField('senderName', e.target.value)}
                      placeholder="발송인명"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">전화번호</Label>
                    <Input
                      value={form.senderPhone}
                      onChange={(e) => updateField('senderPhone', e.target.value)}
                      placeholder="010-0000-0000"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs">주소</Label>
                    <Input
                      value={form.senderAddress}
                      onChange={(e) => updateField('senderAddress', e.target.value)}
                      placeholder="발송인 주소"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 수취인 */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">
                    수취인 정보 <span className="text-destructive">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">이름 *</Label>
                    <Input
                      required
                      value={form.recipientName}
                      onChange={(e) => updateField('recipientName', e.target.value)}
                      placeholder="수취인명"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">전화번호</Label>
                    <Input
                      value={form.recipientPhone}
                      onChange={(e) => updateField('recipientPhone', e.target.value)}
                      placeholder="010-0000-0000"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">우편번호</Label>
                    <Input
                      value={form.recipientZipCode}
                      onChange={(e) => updateField('recipientZipCode', e.target.value)}
                      placeholder="12345"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs">주소 *</Label>
                    <Input
                      required
                      value={form.recipientAddress}
                      onChange={(e) => updateField('recipientAddress', e.target.value)}
                      placeholder="수취인 주소"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 상품 */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">상품 정보</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">상품명 *</Label>
                    <Input
                      required
                      value={form.itemName}
                      onChange={(e) => updateField('itemName', e.target.value)}
                      placeholder="상품명"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">수량</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.quantity}
                      onChange={(e) => updateField('quantity', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">중량(kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.weight}
                      onChange={(e) => updateField('weight', e.target.value)}
                      placeholder="0.0"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 배송 */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">배송 정보</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">배송방법</Label>
                    <Select value={form.shippingMethod} onValueChange={(v) => updateField('shippingMethod', v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SHIPPING_METHOD_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">특이사항</Label>
                    <Textarea
                      value={form.specialNote}
                      onChange={(e) => updateField('specialNote', e.target.value)}
                      placeholder="배송 요청사항"
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Link href="/shipper/orders">
                  <Button type="button" variant="outline">
                    취소
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 등록 중...
                    </>
                  ) : (
                    '주문등록'
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* 엑셀 업로드 탭 */}
          <TabsContent value="excel">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">엑셀 대량 업로드</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-2">
                <p className="text-muted-foreground text-sm">
                  엑셀 파일을 이용하여 대량의 배송 주문을 한번에 등록할 수 있습니다. 템플릿을 다운로드하여 데이터를
                  입력한 후 업로드하세요.
                </p>
                <div className="flex items-center gap-3">
                  <Button onClick={() => setExcelDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> 엑셀 파일 업로드
                  </Button>
                </div>
              </CardContent>
            </Card>

            <ExcelImportDialog
              open={excelDialogOpen}
              onOpenChange={setExcelDialogOpen}
              title="배송 주문 대량 업로드"
              apiEndpoint="/shipper/orders/import"
              templateColumns={templateColumns}
              templateFileName="배송주문_업로드_템플릿"
              keyMap={keyMap}
              onSuccess={() => {
                router.push('/shipper/orders')
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </ShipperLayoutShell>
  )
}

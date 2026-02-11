import { z } from 'zod'

const lineDetailSchema = z.object({
  itemId: z.string().min(1, '품목을 선택하세요'),
  quantity: z.number().min(0.01, '수량은 0보다 커야 합니다'),
  unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다'),
  remark: z.string().optional().nullable(),
})

// ─── 견적 ──────────────────────────────────
export const createQuotationSchema = z.object({
  quotationDate: z.string().min(1, '견적일을 입력하세요'),
  partnerId: z.string().min(1, '거래처를 선택하세요'),
  validUntil: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  details: z.array(lineDetailSchema).min(1, '최소 1개 이상의 품목이 필요합니다'),
})

// ─── 수주 ──────────────────────────────────
export const createSalesOrderSchema = z.object({
  orderDate: z.string().min(1, '수주일을 입력하세요'),
  partnerId: z.string().min(1, '거래처를 선택하세요'),
  quotationId: z.string().optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  salesChannel: z.enum(['ONLINE', 'OFFLINE']).optional().default('OFFLINE'),
  description: z.string().optional().nullable(),
  details: z.array(lineDetailSchema).min(1, '최소 1개 이상의 품목이 필요합니다'),
})

// ─── 납품 ──────────────────────────────────
export const createDeliverySchema = z.object({
  deliveryDate: z.string().min(1, '납품일을 입력하세요'),
  salesOrderId: z.string().min(1, '수주를 선택하세요'),
  deliveryAddress: z.string().optional().nullable(),
  details: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.number().min(0.01),
    unitPrice: z.number().min(0),
  })).min(1, '최소 1개 이상의 품목이 필요합니다'),
})

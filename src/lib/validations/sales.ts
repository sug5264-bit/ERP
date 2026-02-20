import { z } from 'zod'

const lineDetailSchema = z.object({
  itemId: z.string().min(1, '품목을 선택하세요').max(50),
  quantity: z.number().min(0.01, '수량은 0보다 커야 합니다').max(999_999_999),
  unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다').max(999_999_999_999),
  remark: z.string().max(500).optional().nullable(),
})

// ─── 견적 ──────────────────────────────────
export const createQuotationSchema = z.object({
  quotationDate: z.string().min(1, '견적일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  partnerId: z.string().min(1, '거래처를 선택하세요').max(50),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable().or(z.literal('')),
  description: z.string().max(1000).optional().nullable(),
  details: z.array(lineDetailSchema).min(1, '최소 1개 이상의 품목이 필요합니다').max(100),
})

// ─── 수주 ──────────────────────────────────
export const createSalesOrderSchema = z.object({
  orderDate: z.string().min(1, '수주일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  partnerId: z.string().min(1, '거래처를 선택하세요').max(50),
  quotationId: z.string().max(50).optional().nullable(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable().or(z.literal('')),
  salesChannel: z.enum(['ONLINE', 'OFFLINE']).optional().default('OFFLINE'),
  description: z.string().max(1000).optional().nullable(),
  vatIncluded: z.boolean().optional().default(true),
  details: z.array(lineDetailSchema).min(1, '최소 1개 이상의 품목이 필요합니다').max(100),
})

// ─── 납품 ──────────────────────────────────
export const createDeliverySchema = z.object({
  deliveryDate: z.string().min(1, '납품일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  salesOrderId: z.string().min(1, '수주를 선택하세요').max(50),
  deliveryAddress: z.string().max(500).optional().nullable(),
  details: z.array(z.object({
    itemId: z.string().min(1).max(50),
    quantity: z.number().min(0.01).max(999_999_999),
    unitPrice: z.number().min(0).max(999_999_999_999),
  })).min(1, '최소 1개 이상의 품목이 필요합니다').max(100),
})

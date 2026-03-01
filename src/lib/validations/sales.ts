import { z } from 'zod'

const lineDetailSchema = z.object({
  itemId: z.string().min(1, '품목을 선택하세요').max(50),
  quantity: z.number().min(0.01, '수량은 0보다 커야 합니다').max(999_999_999),
  unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다').max(999_999_999_999),
  remark: z.string().max(500).optional().nullable(),
})

// ─── 견적 ──────────────────────────────────
export const createQuotationSchema = z.object({
  quotationDate: z
    .string()
    .min(1, '견적일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  partnerId: z.string().min(1, '거래처를 선택하세요').max(50),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  description: z.string().max(1000).optional().nullable(),
  details: z.array(lineDetailSchema).min(1, '최소 1개 이상의 품목이 필요합니다').max(100),
})

// ─── 수주 ──────────────────────────────────
export const createSalesOrderSchema = z.object({
  orderDate: z
    .string()
    .min(1, '수주일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  partnerId: z.string().max(50).optional().nullable(),
  quotationId: z.string().max(50).optional().nullable(),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  salesChannel: z.enum(['ONLINE', 'OFFLINE']).optional().default('OFFLINE'),
  description: z.string().max(1000).optional().nullable(),
  vatIncluded: z.boolean().optional().default(true),
  // e-commerce order fields
  siteName: z.string().max(100).optional().nullable(),
  ordererName: z.string().max(100).optional().nullable(),
  recipientName: z.string().max(100).optional().nullable(),
  ordererContact: z.string().max(50).optional().nullable(),
  recipientContact: z.string().max(50).optional().nullable(),
  recipientZipCode: z.string().max(20).optional().nullable(),
  recipientAddress: z.string().max(500).optional().nullable(),
  requirements: z.string().max(1000).optional().nullable(),
  senderName: z.string().max(100).optional().nullable(),
  senderPhone: z.string().max(50).optional().nullable(),
  senderAddress: z.string().max(500).optional().nullable(),
  shippingCost: z.number().min(0).max(999_999_999).optional().nullable(),
  trackingNo: z.string().max(100).optional().nullable(),
  specialNote: z.string().max(1000).optional().nullable(),
  details: z.array(lineDetailSchema).min(1, '최소 1개 이상의 품목이 필요합니다').max(100),
})

// ─── 납품 ──────────────────────────────────
export const createDeliverySchema = z.object({
  deliveryDate: z
    .string()
    .min(1, '납품일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  salesOrderId: z.string().min(1, '수주를 선택하세요').max(50),
  deliveryAddress: z.string().max(500).optional().nullable(),
  trackingNo: z.string().max(100).optional().nullable(),
  carrier: z.string().max(100).optional().nullable(),
  details: z
    .array(
      z.object({
        itemId: z.string().min(1).max(50),
        quantity: z.number().min(0.01).max(999_999_999),
        unitPrice: z.number().min(0).max(999_999_999_999),
      })
    )
    .min(1, '최소 1개 이상의 품목이 필요합니다')
    .max(100),
})

// ─── 반품 ──────────────────────────────────
export const createSalesReturnSchema = z.object({
  returnDate: z
    .string()
    .min(1, '반품일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  salesOrderId: z.string().min(1, '수주를 선택하세요').max(50),
  partnerId: z.string().min(1, '거래처를 선택하세요').max(50),
  reason: z.enum(['DEFECT', 'WRONG_ITEM', 'CUSTOMER_CHANGE', 'QUALITY_ISSUE', 'OTHER']).optional().default('OTHER'),
  reasonDetail: z.string().max(1000).optional().nullable(),
  totalAmount: z.number().min(0).max(999_999_999_999).optional().default(0),
  details: z
    .array(
      z.object({
        itemId: z.string().min(1, '품목을 선택하세요').max(50),
        quantity: z.number().min(0.01, '수량은 0보다 커야 합니다').max(999_999_999),
        unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다').max(999_999_999_999),
        remark: z.string().max(500).optional().nullable(),
      })
    )
    .optional()
    .default([]),
})

// ─── 품질검사 ──────────────────────────────
export const createQualityInspectionSchema = z.object({
  deliveryId: z.string().min(1, '납품을 선택하세요').max(50),
  inspectionDate: z
    .string()
    .min(1, '검사일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  inspectorName: z.string().min(1, '검사자명을 입력하세요').max(100),
  overallGrade: z.enum(['A', 'B', 'C', 'REJECT']).default('A'),
  sampleSize: z.number().int().min(0).max(999_999).default(0),
  defectCount: z.number().int().min(0).max(999_999).default(0),
  lotNo: z.string().max(100).optional().nullable(),
  judgement: z.enum(['PASS', 'CONDITIONAL_PASS', 'FAIL']).default('PASS'),
  remarks: z.string().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        category: z.string().min(1, '검사 구분을 입력하세요').max(50),
        checkItem: z.string().min(1, '검사 항목을 입력하세요').max(200),
        spec: z.string().max(200).optional().nullable(),
        measuredValue: z.string().max(200).optional().nullable(),
        result: z.enum(['PASS', 'FAIL', 'NA']).default('PASS'),
        grade: z.enum(['A', 'B', 'C', 'REJECT']).default('A'),
        defectType: z.string().max(100).optional().nullable(),
        remarks: z.string().max(500).optional().nullable(),
      })
    )
    .min(1, '최소 1개 이상의 검사항목이 필요합니다')
    .max(50),
})

export const createQualityStandardSchema = z.object({
  itemId: z.string().min(1, '품목을 선택하세요').max(50),
  standardName: z.string().min(1, '기준명을 입력하세요').max(200),
  category: z.string().min(1, '검사 구분을 입력하세요').max(50),
  checkMethod: z.string().max(500).optional().nullable(),
  spec: z.string().max(200).optional().nullable(),
  minValue: z.number().optional().nullable(),
  maxValue: z.number().optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  isCritical: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
})

// ─── 상계 ──────────────────────────────────
export const createNettingSchema = z.object({
  partnerId: z.string().min(1, '거래처를 선택하세요').max(50),
  amount: z.coerce.number().min(0.01, '금액은 0보다 커야 합니다').max(999_999_999_999),
  nettingDate: z
    .string()
    .min(1, '상계일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  description: z.string().max(1000).optional().nullable(),
})

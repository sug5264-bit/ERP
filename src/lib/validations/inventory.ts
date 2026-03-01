import { z } from 'zod'

// ─── 품목분류 ──────────────────────────────
export const createItemCategorySchema = z.object({
  code: z
    .string()
    .min(1, '분류코드를 입력하세요')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, '코드는 영문, 숫자, 하이픈만 사용 가능합니다'),
  name: z.string().min(1, '분류명을 입력하세요').max(100),
  parentId: z.string().max(50).optional().nullable(),
  level: z.number().int().min(1).max(10).default(1),
})

// ─── 품목 ──────────────────────────────────
export const createItemSchema = z.object({
  itemCode: z
    .string()
    .min(1, '품목코드를 입력하세요')
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, '코드는 영문, 숫자, 하이픈만 사용 가능합니다'),
  itemName: z.string().min(1, '품목명을 입력하세요').max(200),
  specification: z.string().max(500).optional().nullable(),
  categoryId: z.string().max(50).optional().nullable(),
  unit: z.string().max(10).default('EA'),
  standardPrice: z.number().min(0).max(999_999_999_999).default(0),
  safetyStock: z.number().int().min(0).max(999_999_999).default(0),
  itemType: z.enum(['RAW_MATERIAL', 'PRODUCT', 'GOODS', 'SUBSIDIARY']).default('GOODS'),
  taxType: z.enum(['TAXABLE', 'TAX_FREE', 'ZERO_RATE']).default('TAXABLE'),
  barcode: z.string().max(50).optional().nullable(),
  isActive: z.boolean().default(true),
  // 식품 유통 전용 필드
  manufacturer: z.string().max(200).optional().nullable(),
  originCountry: z.string().max(100).optional().nullable(),
  storageTemp: z.string().max(50).optional().nullable(),
  shelfLifeDays: z.number().int().min(0).max(9999).optional().nullable(),
  allergens: z.string().max(500).optional().nullable(),
})

export const updateItemSchema = createItemSchema.partial()

// ─── 창고 ──────────────────────────────────
export const createWarehouseSchema = z.object({
  code: z
    .string()
    .min(1, '창고코드를 입력하세요')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, '코드는 영문, 숫자, 하이픈만 사용 가능합니다'),
  name: z.string().min(1, '창고명을 입력하세요').max(100),
  location: z.string().max(500).optional().nullable(),
  managerId: z.string().max(50).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const createWarehouseZoneSchema = z.object({
  warehouseId: z.string().min(1),
  zoneCode: z.string().min(1, '구역코드를 입력하세요'),
  zoneName: z.string().min(1, '구역명을 입력하세요'),
})

// ─── 입출고 ────────────────────────────────
export const createStockMovementSchema = z.object({
  movementDate: z.string().min(1, '이동일자를 입력하세요'),
  movementType: z.enum(['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT']),
  sourceWarehouseId: z.string().optional().nullable(),
  targetWarehouseId: z.string().optional().nullable(),
  relatedDocType: z.string().optional().nullable(),
  relatedDocId: z.string().optional().nullable(),
  details: z
    .array(
      z.object({
        itemId: z.string().min(1, '품목을 선택하세요'),
        quantity: z.number().min(0.01, '수량은 0보다 커야 합니다'),
        unitPrice: z.number().min(0).default(0),
        lotNo: z.string().optional().nullable(),
        expiryDate: z.string().optional().nullable(),
      })
    )
    .min(1, '최소 1개 이상의 품목이 필요합니다'),
})

// ─── 거래처 ────────────────────────────────
export const createPartnerSchema = z.object({
  partnerCode: z
    .string()
    .min(1, '거래처코드를 입력하세요')
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, '코드는 영문, 숫자, 하이픈만 사용 가능합니다'),
  partnerName: z.string().min(1, '거래처명을 입력하세요').max(200),
  partnerType: z.enum(['SALES', 'PURCHASE', 'BOTH']).default('BOTH'),
  bizNo: z
    .string()
    .max(20)
    .regex(/^(\d{3}-\d{2}-\d{5}|\d{10})?$/, '올바른 사업자번호 형식이 아닙니다 (000-00-00000)')
    .optional()
    .nullable()
    .or(z.literal('')),
  ceoName: z.string().max(50).optional().nullable(),
  bizType: z.string().max(100).optional().nullable(),
  bizCategory: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  fax: z.string().max(20).optional().nullable(),
  email: z.string().email('유효한 이메일을 입력하세요').max(200).optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable(),
  contactPerson: z.string().max(50).optional().nullable(),
  creditLimit: z.number().min(0).max(999_999_999_999).optional().nullable(),
  paymentTerms: z.string().max(100).optional().nullable(),
  salesChannel: z.enum(['ONLINE', 'OFFLINE']).default('OFFLINE'),
  isActive: z.boolean().default(true),
  // OEM 식품 제조사 전용 필드
  foodBizNo: z.string().max(50).optional().nullable(),
  haccpNo: z.string().max(50).optional().nullable(),
  factoryAddress: z.string().max(500).optional().nullable(),
})

export const updatePartnerSchema = createPartnerSchema.partial()

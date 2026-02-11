import { z } from 'zod'

// ─── 품목분류 ──────────────────────────────
export const createItemCategorySchema = z.object({
  code: z.string().min(1, '분류코드를 입력하세요'),
  name: z.string().min(1, '분류명을 입력하세요'),
  parentId: z.string().optional().nullable(),
  level: z.number().int().default(1),
})

// ─── 품목 ──────────────────────────────────
export const createItemSchema = z.object({
  itemCode: z.string().min(1, '품목코드를 입력하세요'),
  itemName: z.string().min(1, '품목명을 입력하세요'),
  specification: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  unit: z.string().default('EA'),
  standardPrice: z.number().min(0).default(0),
  safetyStock: z.number().int().min(0).default(0),
  itemType: z.enum(['RAW_MATERIAL', 'PRODUCT', 'GOODS', 'SUBSIDIARY']).default('GOODS'),
  taxType: z.enum(['TAXABLE', 'TAX_FREE', 'ZERO_RATE']).default('TAXABLE'),
  barcode: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const updateItemSchema = createItemSchema.partial()

// ─── 창고 ──────────────────────────────────
export const createWarehouseSchema = z.object({
  code: z.string().min(1, '창고코드를 입력하세요'),
  name: z.string().min(1, '창고명을 입력하세요'),
  location: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
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
  details: z.array(z.object({
    itemId: z.string().min(1, '품목을 선택하세요'),
    quantity: z.number().min(0.01, '수량은 0보다 커야 합니다'),
    unitPrice: z.number().min(0).default(0),
    lotNo: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
  })).min(1, '최소 1개 이상의 품목이 필요합니다'),
})

// ─── 거래처 ────────────────────────────────
export const createPartnerSchema = z.object({
  partnerCode: z.string().min(1, '거래처코드를 입력하세요'),
  partnerName: z.string().min(1, '거래처명을 입력하세요'),
  partnerType: z.enum(['SALES', 'PURCHASE', 'BOTH']).default('BOTH'),
  bizNo: z.string().optional().nullable(),
  ceoName: z.string().optional().nullable(),
  bizType: z.string().optional().nullable(),
  bizCategory: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  creditLimit: z.number().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  salesChannel: z.enum(['ONLINE', 'OFFLINE']).default('OFFLINE'),
  isActive: z.boolean().default(true),
})

export const updatePartnerSchema = createPartnerSchema.partial()

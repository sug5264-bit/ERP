import { z } from 'zod'

// 전표
export const createVoucherSchema = z.object({
  voucherDate: z.string().min(1, '전표일자를 입력하세요'),
  voucherType: z.enum(['RECEIPT', 'PAYMENT', 'TRANSFER', 'PURCHASE', 'SALES']),
  description: z.string().optional(),
  details: z
    .array(
      z.object({
        accountSubjectId: z.string().min(1, '계정과목을 선택하세요'),
        debitAmount: z.number().min(0).default(0),
        creditAmount: z.number().min(0).default(0),
        partnerId: z.string().optional(),
        description: z.string().optional(),
        costCenterId: z.string().optional(),
      })
    )
    .min(1, '분개 항목을 하나 이상 입력하세요'),
})

export const updateVoucherSchema = createVoucherSchema.partial()

// 세금계산서
export const createTaxInvoiceSchema = z.object({
  issueDate: z.string().min(1, '발행일을 입력하세요'),
  invoiceType: z.enum(['SALES', 'PURCHASE']),
  supplierBizNo: z.string().min(1, '공급자 사업자번호를 입력하세요'),
  supplierName: z.string().min(1, '공급자명을 입력하세요'),
  supplierCeo: z.string().optional(),
  supplierAddress: z.string().optional(),
  supplierBizType: z.string().optional(),
  supplierBizCategory: z.string().optional(),
  buyerBizNo: z.string().min(1, '공급받는자 사업자번호를 입력하세요'),
  buyerName: z.string().min(1, '공급받는자명을 입력하세요'),
  buyerCeo: z.string().optional(),
  buyerAddress: z.string().optional(),
  buyerBizType: z.string().optional(),
  buyerBizCategory: z.string().optional(),
  partnerId: z.string().optional(),
  voucherId: z.string().optional(),
  items: z
    .array(
      z.object({
        itemDate: z.string().min(1),
        itemName: z.string().min(1, '품목명을 입력하세요'),
        specification: z.string().optional(),
        qty: z.number().min(0),
        unitPrice: z.number().min(0),
        supplyAmount: z.number().min(0),
        taxAmount: z.number().min(0),
      })
    )
    .min(1, '품목을 하나 이상 입력하세요'),
})

// 계정과목
export const createAccountSubjectSchema = z.object({
  code: z.string().min(1, '계정코드를 입력하세요'),
  nameKo: z.string().min(1, '계정명을 입력하세요'),
  nameEn: z.string().optional(),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  level: z.number().min(1).default(1),
  parentId: z.string().nullable().optional(),
  taxRelated: z.boolean().default(false),
})

// 예산
export const createBudgetSchema = z.object({
  fiscalYearId: z.string().min(1, '회계연도를 선택하세요'),
  departmentId: z.string().min(1, '부서를 선택하세요'),
  details: z.array(
    z.object({
      accountSubjectId: z.string().min(1),
      month01: z.number().default(0),
      month02: z.number().default(0),
      month03: z.number().default(0),
      month04: z.number().default(0),
      month05: z.number().default(0),
      month06: z.number().default(0),
      month07: z.number().default(0),
      month08: z.number().default(0),
      month09: z.number().default(0),
      month10: z.number().default(0),
      month11: z.number().default(0),
      month12: z.number().default(0),
    })
  ),
})

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>
export type CreateTaxInvoiceInput = z.infer<typeof createTaxInvoiceSchema>
export type CreateAccountSubjectInput = z.infer<typeof createAccountSubjectSchema>
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>

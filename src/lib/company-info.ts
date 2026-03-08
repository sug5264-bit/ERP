/**
 * 기본 회사 정보 조회 유틸리티 (클라이언트용)
 * PDF 생성 시 회사 정보를 자동으로 연동합니다.
 */

export interface CompanyInfo {
  name: string
  ceo?: string
  address?: string
  tel?: string
  bizNo?: string
  bizType?: string
  bizCategory?: string
  fax?: string
  email?: string
  bankName?: string
  bankAccount?: string
  bankHolder?: string
  logoPath?: string
  sealPath?: string
}

let cachedCompanyInfo: CompanyInfo | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * 기본 회사 정보를 조회합니다.
 * 5분간 캐시되며, 실패 시 기본값을 반환합니다.
 */
export async function getDefaultCompanyInfo(): Promise<CompanyInfo> {
  const now = Date.now()
  if (cachedCompanyInfo && now - cacheTimestamp < CACHE_TTL) {
    return cachedCompanyInfo
  }

  try {
    const res = await fetch('/api/v1/admin/company')
    if (!res.ok) throw new Error('Failed to fetch company info')
    const json = await res.json()
    const companies = json.data as Record<string, unknown>[]
    const defaultCompany = companies?.find((c) => c.isDefault) || companies?.[0]

    if (defaultCompany) {
      cachedCompanyInfo = {
        name: String(defaultCompany.companyName || ''),
        ceo: defaultCompany.ceoName as string | undefined,
        address: defaultCompany.address as string | undefined,
        tel: defaultCompany.phone as string | undefined,
        bizNo: defaultCompany.bizNo as string | undefined,
        bizType: defaultCompany.bizType as string | undefined,
        bizCategory: defaultCompany.bizCategory as string | undefined,
        fax: defaultCompany.fax as string | undefined,
        email: defaultCompany.email as string | undefined,
        bankName: defaultCompany.bankName as string | undefined,
        bankAccount: defaultCompany.bankAccount as string | undefined,
        bankHolder: defaultCompany.bankHolder as string | undefined,
        logoPath: defaultCompany.logoPath as string | undefined,
        sealPath: defaultCompany.sealPath as string | undefined,
      }
      cacheTimestamp = now
      return cachedCompanyInfo
    }
  } catch { /* use fallback */ }

  return { name: '(주)웰그린' }
}

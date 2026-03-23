/**
 * 거래명세서 PDF 생성 모듈
 * - generateTransactionStatement: 파일 저장
 * - generateTransactionStatementBlob: Blob 반환 (ZIP 등에 활용)
 */

import {
  createPDFDocument,
  addPageNumbers,
  PDF_COLORS,
  fmtNumber,
  fmtPrintDate,
  getLastTableY,
  PAGE_MARGIN,
  labelColumnStyle,
} from './pdf-base'
import { getDefaultCompanyInfo } from '@/lib/company-info'
import { sanitizeFileName } from '@/lib/sanitize'

// ---------------------------------------------------------------------------
// 인터페이스
// ---------------------------------------------------------------------------

export interface TransactionStatementItem {
  itemName: string
  itemCode?: string
  specification?: string
  unit?: string
  quantity: number
  unitPrice: number
  supplyAmount: number
  taxAmount: number
  totalAmount: number
  remark?: string
}

export interface TransactionStatementData {
  orderNo: string
  orderDate: string
  partnerName?: string
  partnerBizNo?: string
  partnerCeo?: string
  partnerAddress?: string
  partnerContact?: string
  totalSupply: number
  totalTax: number
  totalAmount: number
  description?: string
  items: TransactionStatementItem[]
  vatIncluded?: boolean
}

// ---------------------------------------------------------------------------
// 직인 이미지 로드 헬퍼
// ---------------------------------------------------------------------------

async function loadSealImage(sealPath: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/v1/admin/company/file/${sealPath}`)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 내부 공통 PDF 생성
// ---------------------------------------------------------------------------

async function buildTransactionStatementPdf(order: TransactionStatementData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()
  const company = await getDefaultCompanyInfo()

  const M = PAGE_MARGIN
  const W = pageWidth - 2 * M
  let y = 18

  // ─── 1. 제목 ───
  doc.setFontSize(18)
  doc.setFont(fontName, 'normal')
  doc.text('거 래 명 세 서', pageWidth / 2, y, { align: 'center' })
  y += 12

  // ─── 2. 문서번호 / 발행일 (우측) ───
  doc.setFontSize(9)
  doc.text(`문서번호: ${order.orderNo}`, pageWidth - M, y, { align: 'right' })
  y += 5
  doc.text(`발행일: ${order.orderDate}`, pageWidth - M, y, { align: 'right' })
  y += 8

  // ─── 3. 공급받는자 / 공급자 정보 테이블 ───
  const halfW = W / 2
  const labelW = 28

  // 헤더 행
  const infoHead = [
    [
      {
        content: '공급받는자 (인수자)',
        colSpan: 2,
        styles: {
          halign: 'center' as const,
          fillColor: PDF_COLORS.HEADER_FILL,
          textColor: PDF_COLORS.HEADER_TEXT,
          fontStyle: 'bold' as const,
        },
      },
      {
        content: '공급자 (공급)',
        colSpan: 2,
        styles: {
          halign: 'center' as const,
          fillColor: PDF_COLORS.HEADER_FILL,
          textColor: PDF_COLORS.HEADER_TEXT,
          fontStyle: 'bold' as const,
        },
      },
    ],
  ]

  const infoBody = [
    [
      { content: '상호', styles: labelColumnStyle },
      order.partnerName || '-',
      { content: '상호', styles: labelColumnStyle },
      company.name || '-',
    ],
    [
      { content: '사업자등록번호', styles: labelColumnStyle },
      order.partnerBizNo || '-',
      { content: '사업자등록번호', styles: labelColumnStyle },
      company.bizNo || '-',
    ],
    [
      { content: '대표자', styles: labelColumnStyle },
      order.partnerCeo || '-',
      { content: '대표자', styles: labelColumnStyle },
      company.ceo || '-',
    ],
    [
      { content: '주소', styles: labelColumnStyle },
      order.partnerAddress || '-',
      { content: '주소', styles: labelColumnStyle },
      company.address || '-',
    ],
    [
      { content: '업태/종목', styles: labelColumnStyle },
      '-',
      { content: '업태/종목', styles: labelColumnStyle },
      [company.bizType, company.bizCategory].filter(Boolean).join(' / ') || '-',
    ],
  ]

  autoTable({
    startY: y,
    head: infoHead,
    body: infoBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: labelW },
      1: { cellWidth: halfW - labelW },
      2: { cellWidth: labelW },
      3: { cellWidth: halfW - labelW },
    },
    margin: { left: M, right: M },
  })
  y = getLastTableY(doc) + 6

  // ─── 4. 안내 문구 ───
  doc.setFontSize(10)
  doc.setFont(fontName, 'normal')
  doc.text('아래와 같이 거래명세서를 발행합니다.', pageWidth / 2, y, { align: 'center' })
  y += 8

  // ─── 5. 품목 테이블 ───
  const itemHead = [['No', '품목명', '규격', '수량', '단가', '공급가액', '세액', '합계', '비고']]
  const itemBody = order.items.map((item, idx) => [
    String(idx + 1),
    item.itemName,
    item.specification || '-',
    fmtNumber(item.quantity),
    fmtNumber(item.unitPrice),
    fmtNumber(item.supplyAmount),
    fmtNumber(item.taxAmount),
    fmtNumber(item.totalAmount),
    item.remark || '',
  ])

  autoTable({
    startY: y,
    head: itemHead,
    body: itemBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: PDF_COLORS.HEADER_FILL,
      textColor: PDF_COLORS.HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' as unknown as number },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 26, halign: 'right' },
      8: { cellWidth: 20 },
    },
    margin: { left: M, right: M },
  })
  y = getLastTableY(doc) + 2

  // ─── 6. 합계 행 ───
  autoTable({
    startY: y,
    body: [
      [
        { content: '합  계', colSpan: 2, styles: { ...labelColumnStyle, fontSize: 9 } },
        { content: `공급가액: ${fmtNumber(order.totalSupply)}`, styles: { halign: 'right' as const } },
        { content: `세액: ${fmtNumber(order.totalTax)}`, styles: { halign: 'right' as const } },
        {
          content: `총액: ${fmtNumber(order.totalAmount)}`,
          styles: { halign: 'right' as const, fontStyle: 'bold' as const },
        },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: W * 0.2 },
      1: { cellWidth: W * 0.1 },
      2: { cellWidth: W * 0.25 },
      3: { cellWidth: W * 0.2 },
      4: { cellWidth: W * 0.25 },
    },
    margin: { left: M, right: M },
  })
  y = getLastTableY(doc) + 6

  // ─── 7. 입금계좌 정보 ───
  if (company.bankName || company.bankAccount) {
    autoTable({
      startY: y,
      body: [
        [
          { content: '입금계좌', styles: labelColumnStyle },
          [company.bankName, company.bankAccount, company.bankHolder].filter(Boolean).join(' / '),
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: labelW },
        1: { cellWidth: W - labelW },
      },
      margin: { left: M, right: M },
    })
    y = getLastTableY(doc) + 6
  }

  // ─── 8. 직인 이미지 ───
  if (company.sealPath) {
    const sealDataUrl = await loadSealImage(company.sealPath)
    if (sealDataUrl) {
      const sealSize = 25
      const sealX = pageWidth - M - sealSize - 5
      doc.addImage(sealDataUrl, 'PNG', sealX, y, sealSize, sealSize)
    }
  }

  // ─── 푸터 ───
  addPageNumbers(doc, fontName, { prefix: `출력일: ${fmtPrintDate()}`, bottomOffset: 10 })

  return doc
}

// ---------------------------------------------------------------------------
// 공개 함수
// ---------------------------------------------------------------------------

/** 거래명세서 PDF 생성 후 파일로 저장 */
export async function generateTransactionStatement(order: TransactionStatementData): Promise<void> {
  const doc = await buildTransactionStatementPdf(order)
  const fileName = sanitizeFileName(`거래명세서_${order.orderNo}_${order.partnerName || ''}`) + '.pdf'
  doc.save(fileName)
}

/** 거래명세서 PDF 생성 후 Blob 반환 (ZIP 용도) */
export async function generateTransactionStatementBlob(order: TransactionStatementData): Promise<Blob> {
  const doc = await buildTransactionStatementPdf(order)
  return doc.output('blob')
}

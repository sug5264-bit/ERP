import {
  createPDFDocument,
  addPageNumbers,
  getLastTableY,
  PDF_COLORS,
  PAGE_MARGIN,
  defaultHeadStyles,
  labelColumnStyle,
  fmtNumber,
} from '@/lib/export/pdf-base'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface QuotationPDFData {
  quotationNo: string
  quotationDate: string
  validUntil?: string
  company: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  partner: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  items: {
    no: number
    itemName: string
    spec?: string
    qty: number
    unitPrice: number
    supplyAmount: number
    taxAmount: number
    totalAmount: number
  }[]
  totalSupply: number
  totalTax: number
  totalAmount: number
  description?: string
}

export interface TaxInvoicePDFData {
  invoiceNo: string
  invoiceDate: string
  supplier: {
    name: string
    bizNo: string
    ceo: string
    address: string
    bizType?: string
    bizItem?: string
  }
  buyer: {
    name: string
    bizNo: string
    ceo: string
    address: string
    bizType?: string
    bizItem?: string
  }
  items: {
    month: string
    day: string
    itemName: string
    spec?: string
    qty: number
    unitPrice: number
    supplyAmount: number
    taxAmount: number
  }[]
  totalSupply: number
  totalTax: number
  totalAmount: number
}

export interface TransactionStatementPDFData {
  statementNo: string
  statementDate: string
  supplier: { name: string; bizNo?: string; ceo?: string; address?: string; tel?: string }
  buyer: { name: string; bizNo?: string; ceo?: string; address?: string; tel?: string }
  items: {
    no: number
    itemName: string
    spec?: string
    qty: number
    unitPrice: number
    amount: number
    remark?: string
  }[]
  totalAmount: number
  description?: string
}

// ---------------------------------------------------------------------------
// 공통 스타일 프리셋
// ---------------------------------------------------------------------------

const infoTableStyles = {
  theme: 'grid' as const,
  styles: { fontSize: 8, cellPadding: 2 },
  headStyles: defaultHeadStyles,
  margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
}

const itemTableStyles = {
  theme: 'grid' as const,
  styles: { fontSize: 8, cellPadding: 2 },
  headStyles: defaultHeadStyles,
  margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
}

const summaryTableStyles = {
  theme: 'grid' as const,
  styles: { fontSize: 9, cellPadding: 2.5, halign: 'right' as const },
  headStyles: defaultHeadStyles,
  margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
}

// ---------------------------------------------------------------------------
// 1. 견적서 (Quotation)
// ---------------------------------------------------------------------------

export async function generateQuotationPDF(data: QuotationPDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()

  let y = 15

  // --- 제목 ---
  doc.setFontSize(20)
  doc.text('견 적 서', pageWidth / 2, y, { align: 'center' })
  y += 10

  // --- 견적 메타정보 ---
  doc.setFontSize(9)
  doc.text(`견적번호: ${data.quotationNo}`, PAGE_MARGIN, y)
  doc.text(`견적일자: ${data.quotationDate}`, pageWidth / 2, y)
  y += 5
  if (data.validUntil) {
    doc.text(`유효기한: ${data.validUntil}`, PAGE_MARGIN, y)
    y += 5
  }
  y += 2

  // --- 공급자 / 공급받는자 정보 ---
  autoTable({
    ...infoTableStyles,
    startY: y,
    head: [['', '공급자 (공급하는 자)', '', '공급받는자']],
    body: [
      ['상호', data.company.name, '상호', data.partner.name],
      ['대표자', data.company.ceo ?? '', '대표자', data.partner.ceo ?? ''],
      ['사업자번호', data.company.bizNo ?? '', '사업자번호', data.partner.bizNo ?? ''],
      ['주소', data.company.address ?? '', '주소', data.partner.address ?? ''],
      ['전화', data.company.tel ?? '', '전화', data.partner.tel ?? ''],
    ],
    columnStyles: {
      0: { cellWidth: 25, ...labelColumnStyle },
      1: { cellWidth: 65 },
      2: { cellWidth: 25, ...labelColumnStyle },
      3: { cellWidth: 65 },
    },
  })
  y = getLastTableY(doc) + 6

  // --- 합계금액 ---
  autoTable({
    ...summaryTableStyles,
    startY: y,
    head: [['합계금액', '공급가액', '세액', '총액']],
    body: [
      [fmtNumber(data.totalAmount), fmtNumber(data.totalSupply), fmtNumber(data.totalTax), fmtNumber(data.totalAmount)],
    ],
    columnStyles: {
      0: { halign: 'right' as const, fontStyle: 'bold' as const },
    },
  })
  y = getLastTableY(doc) + 4

  // --- 품목 테이블 ---
  autoTable({
    ...itemTableStyles,
    startY: y,
    head: [['No', '품명', '규격', '수량', '단가', '공급가액', '세액', '합계']],
    body: data.items.map((item) => [
      String(item.no),
      item.itemName,
      item.spec ?? '',
      fmtNumber(item.qty),
      fmtNumber(item.unitPrice),
      fmtNumber(item.supplyAmount),
      fmtNumber(item.taxAmount),
      fmtNumber(item.totalAmount),
    ]),
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 25, halign: 'right' },
    },
  })
  y = getLastTableY(doc) + 8

  // --- 비고 ---
  if (data.description) {
    doc.setFontSize(9)
    doc.text(`비고: ${data.description}`, PAGE_MARGIN, y)
    y += 8
  }

  // --- 푸터 ---
  doc.setFontSize(11)
  doc.text('위와 같이 견적합니다.', pageWidth / 2, y, { align: 'center' })

  addPageNumbers(doc, fontName)
  doc.save(`견적서_${data.quotationNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 2. 세금계산서 (Tax Invoice)
// ---------------------------------------------------------------------------

export async function generateTaxInvoicePDF(data: TaxInvoicePDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()

  let y = 15

  // --- 제목 ---
  doc.setFontSize(20)
  doc.text('세 금 계 산 서', pageWidth / 2, y, { align: 'center' })
  y += 8

  // --- 발행 메타정보 ---
  doc.setFontSize(9)
  doc.text(`발행번호: ${data.invoiceNo}`, PAGE_MARGIN, y)
  doc.text(`작성일자: ${data.invoiceDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  y += 6

  // --- 공급자 / 공급받는자 정보 ---
  autoTable({
    ...infoTableStyles,
    startY: y,
    head: [['', '공급자', '', '공급받는자']],
    body: [
      ['사업자등록번호', data.supplier.bizNo, '사업자등록번호', data.buyer.bizNo],
      ['상호(법인명)', data.supplier.name, '상호(법인명)', data.buyer.name],
      ['성명(대표자)', data.supplier.ceo, '성명(대표자)', data.buyer.ceo],
      ['사업장주소', data.supplier.address, '사업장주소', data.buyer.address],
      ['업태', data.supplier.bizType ?? '', '업태', data.buyer.bizType ?? ''],
      ['종목', data.supplier.bizItem ?? '', '종목', data.buyer.bizItem ?? ''],
    ],
    columnStyles: {
      0: { cellWidth: 28, ...labelColumnStyle },
      1: { cellWidth: 62 },
      2: { cellWidth: 28, ...labelColumnStyle },
      3: { cellWidth: 62 },
    },
  })
  y = getLastTableY(doc) + 4

  // --- 합계 ---
  autoTable({
    ...summaryTableStyles,
    startY: y,
    head: [['공급가액', '세액', '합계금액']],
    body: [[fmtNumber(data.totalSupply), fmtNumber(data.totalTax), fmtNumber(data.totalAmount)]],
  })
  y = getLastTableY(doc) + 4

  // --- 품목 테이블 ---
  autoTable({
    ...itemTableStyles,
    startY: y,
    head: [['월', '일', '품목', '규격', '수량', '단가', '공급가액', '세액']],
    body: data.items.map((item) => [
      item.month,
      item.day,
      item.itemName,
      item.spec ?? '',
      fmtNumber(item.qty),
      fmtNumber(item.unitPrice),
      fmtNumber(item.supplyAmount),
      fmtNumber(item.taxAmount),
    ]),
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 40 },
      3: { cellWidth: 22 },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
    },
  })
  y = getLastTableY(doc) + 4

  // --- 합계 행 ---
  autoTable({
    startY: y,
    theme: 'grid',
    body: [['합계', '', '', '', '', '', fmtNumber(data.totalSupply), fmtNumber(data.totalTax)]],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold', fillColor: PDF_COLORS.LIGHT_GRAY },
      1: { cellWidth: 14 },
      2: { cellWidth: 40 },
      3: { cellWidth: 22 },
      4: { cellWidth: 18 },
      5: { cellWidth: 24 },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })
  y = getLastTableY(doc) + 10

  // --- 푸터 ---
  doc.setFontSize(11)
  doc.text('이 금액을 청구함', pageWidth / 2, y, { align: 'center' })

  addPageNumbers(doc, fontName)
  doc.save(`세금계산서_${data.invoiceNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 3. 거래명세표 (Transaction Statement)
// ---------------------------------------------------------------------------

export async function generateTransactionStatementPDF(data: TransactionStatementPDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()

  let y = 15

  // --- 제목 ---
  doc.setFontSize(20)
  doc.text('거 래 명 세 표', pageWidth / 2, y, { align: 'center' })
  y += 8

  // --- 문서 메타정보 ---
  doc.setFontSize(9)
  doc.text(`문서번호: ${data.statementNo}`, PAGE_MARGIN, y)
  doc.text(`작성일자: ${data.statementDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  y += 6

  // --- 공급자 / 공급받는자 정보 ---
  autoTable({
    ...infoTableStyles,
    startY: y,
    head: [['', '공급자', '', '공급받는자']],
    body: [
      ['상호', data.supplier.name, '상호', data.buyer.name],
      ['대표자', data.supplier.ceo ?? '', '대표자', data.buyer.ceo ?? ''],
      ['사업자번호', data.supplier.bizNo ?? '', '사업자번호', data.buyer.bizNo ?? ''],
      ['주소', data.supplier.address ?? '', '주소', data.buyer.address ?? ''],
      ['전화', data.supplier.tel ?? '', '전화', data.buyer.tel ?? ''],
    ],
    columnStyles: {
      0: { cellWidth: 25, ...labelColumnStyle },
      1: { cellWidth: 65 },
      2: { cellWidth: 25, ...labelColumnStyle },
      3: { cellWidth: 65 },
    },
  })
  y = getLastTableY(doc) + 6

  // --- 품목 테이블 ---
  autoTable({
    ...itemTableStyles,
    startY: y,
    head: [['No', '품명', '규격', '수량', '단가', '금액', '비고']],
    body: data.items.map((item) => [
      String(item.no),
      item.itemName,
      item.spec ?? '',
      fmtNumber(item.qty),
      fmtNumber(item.unitPrice),
      fmtNumber(item.amount),
      item.remark ?? '',
    ]),
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 27 },
    },
  })
  y = getLastTableY(doc) + 2

  // --- 합계 행 ---
  autoTable({
    startY: y,
    theme: 'grid',
    body: [['', '합 계', '', '', '', fmtNumber(data.totalAmount), '']],
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 45, halign: 'center', fontStyle: 'bold', fillColor: PDF_COLORS.LIGHT_GRAY },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 27 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })
  y = getLastTableY(doc) + 6

  // --- 비고 ---
  if (data.description) {
    doc.setFontSize(9)
    doc.text(`비고: ${data.description}`, PAGE_MARGIN, y)
  }

  addPageNumbers(doc, fontName)
  doc.save(`거래명세표_${data.statementNo}.pdf`)
}

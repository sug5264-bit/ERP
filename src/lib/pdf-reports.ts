import { loadKoreanFont } from '@/lib/pdf-font'

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
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) => n.toLocaleString('ko-KR')

const PAGE_MARGIN = 14

// Common color palette
const HEADER_FILL: [number, number, number] = [68, 114, 196]
const HEADER_TEXT: [number, number, number] = [255, 255, 255]
const LIGHT_GRAY: [number, number, number] = [240, 240, 240]

// ---------------------------------------------------------------------------
// 1. 견적서 (Quotation)
// ---------------------------------------------------------------------------

export async function generateQuotationPDF(data: QuotationPDFData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const fontName = await loadKoreanFont(doc)

  let y = 15

  // --- Title ---
  doc.setFontSize(20)
  doc.text('견 적 서', pageWidth / 2, y, { align: 'center' })
  y += 10

  // --- Quotation meta info ---
  doc.setFontSize(9)
  doc.text(`견적번호: ${data.quotationNo}`, PAGE_MARGIN, y)
  doc.text(`견적일자: ${data.quotationDate}`, pageWidth / 2, y)
  y += 5
  if (data.validUntil) {
    doc.text(`유효기한: ${data.validUntil}`, PAGE_MARGIN, y)
    y += 5
  }

  y += 2

  // --- Company / Partner info boxes using autoTable ---
  const companyRows = [
    ['상호', data.company.name, '상호', data.partner.name],
    ['대표자', data.company.ceo ?? '', '대표자', data.partner.ceo ?? ''],
    ['사업자번호', data.company.bizNo ?? '', '사업자번호', data.partner.bizNo ?? ''],
    ['주소', data.company.address ?? '', '주소', data.partner.address ?? ''],
    ['전화', data.company.tel ?? '', '전화', data.partner.tel ?? ''],
  ]

  autoTable(doc, {
    startY: y,
    head: [['', '공급자 (공급하는 자)', '', '공급받는자']],
    body: companyRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: fontName },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 25, fillColor: LIGHT_GRAY, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 25, fillColor: LIGHT_GRAY, fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 65 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 6

  // --- Total amount summary ---
  autoTable(doc, {
    startY: y,
    head: [['합계금액', '공급가액', '세액', '총액']],
    body: [[fmt(data.totalAmount), fmt(data.totalSupply), fmt(data.totalTax), fmt(data.totalAmount)]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, halign: 'right', font: fontName },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  // --- Items table ---
  const itemHead = [['No', '품명', '규격', '수량', '단가', '공급가액', '세액', '합계']]
  const itemBody = data.items.map((item) => [
    String(item.no),
    item.itemName,
    item.spec ?? '',
    fmt(item.qty),
    fmt(item.unitPrice),
    fmt(item.supplyAmount),
    fmt(item.taxAmount),
    fmt(item.totalAmount),
  ])

  autoTable(doc, {
    startY: y,
    head: itemHead,
    body: itemBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: fontName },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
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
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 8

  // --- Description ---
  if (data.description) {
    doc.setFontSize(9)
    doc.text(`비고: ${data.description}`, PAGE_MARGIN, y)
    y += 8
  }

  // --- Footer ---
  doc.setFontSize(11)
  doc.text('위와 같이 견적합니다.', pageWidth / 2, y, { align: 'center' })

  // --- Page numbers ---
  addPageNumbers(doc, fontName)

  doc.save(`견적서_${data.quotationNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 2. 세금계산서 (Tax Invoice)
// ---------------------------------------------------------------------------

export async function generateTaxInvoicePDF(data: TaxInvoicePDFData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const fontName = await loadKoreanFont(doc)

  let y = 15

  // --- Title ---
  doc.setFontSize(20)
  doc.text('세 금 계 산 서', pageWidth / 2, y, { align: 'center' })
  y += 8

  // --- Invoice meta ---
  doc.setFontSize(9)
  doc.text(`발행번호: ${data.invoiceNo}`, PAGE_MARGIN, y)
  doc.text(`작성일자: ${data.invoiceDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  y += 6

  // --- Supplier / Buyer info (standard Korean tax invoice two-column header) ---
  const infoRows = [
    ['사업자등록번호', data.supplier.bizNo, '사업자등록번호', data.buyer.bizNo],
    ['상호(법인명)', data.supplier.name, '상호(법인명)', data.buyer.name],
    ['성명(대표자)', data.supplier.ceo, '성명(대표자)', data.buyer.ceo],
    ['사업장주소', data.supplier.address, '사업장주소', data.buyer.address],
    ['업태', data.supplier.bizType ?? '', '업태', data.buyer.bizType ?? ''],
    ['종목', data.supplier.bizItem ?? '', '종목', data.buyer.bizItem ?? ''],
  ]

  autoTable(doc, {
    startY: y,
    head: [['', '공급자', '', '공급받는자']],
    body: infoRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: fontName },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 28, fillColor: LIGHT_GRAY, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 62 },
      2: { cellWidth: 28, fillColor: LIGHT_GRAY, fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 62 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  // --- Total summary row ---
  autoTable(doc, {
    startY: y,
    head: [['공급가액', '세액', '합계금액']],
    body: [[fmt(data.totalSupply), fmt(data.totalTax), fmt(data.totalAmount)]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, halign: 'right', font: fontName },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  // --- Items table ---
  const itemHead = [['월', '일', '품목', '규격', '수량', '단가', '공급가액', '세액']]
  const itemBody = data.items.map((item) => [
    item.month,
    item.day,
    item.itemName,
    item.spec ?? '',
    fmt(item.qty),
    fmt(item.unitPrice),
    fmt(item.supplyAmount),
    fmt(item.taxAmount),
  ])

  autoTable(doc, {
    startY: y,
    head: itemHead,
    body: itemBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: fontName },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
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
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  // --- Totals footer row inside table ---
  autoTable(doc, {
    startY: y,
    body: [['합계', '', '', '', '', '', fmt(data.totalSupply), fmt(data.totalTax)]],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: fontName },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold', fillColor: LIGHT_GRAY },
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

  y = (doc as any).lastAutoTable.finalY + 10

  // --- Footer text ---
  doc.setFontSize(11)
  doc.text('이 금액을 청구함', pageWidth / 2, y, { align: 'center' })

  // --- Page numbers ---
  addPageNumbers(doc, fontName)

  doc.save(`세금계산서_${data.invoiceNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 3. 거래명세표 (Transaction Statement)
// ---------------------------------------------------------------------------

export async function generateTransactionStatementPDF(data: TransactionStatementPDFData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const fontName = await loadKoreanFont(doc)

  let y = 15

  // --- Title ---
  doc.setFontSize(20)
  doc.text('거 래 명 세 표', pageWidth / 2, y, { align: 'center' })
  y += 8

  // --- Statement meta ---
  doc.setFontSize(9)
  doc.text(`문서번호: ${data.statementNo}`, PAGE_MARGIN, y)
  doc.text(`작성일자: ${data.statementDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  y += 6

  // --- Supplier / Buyer info boxes ---
  const infoRows = [
    ['상호', data.supplier.name, '상호', data.buyer.name],
    ['대표자', data.supplier.ceo ?? '', '대표자', data.buyer.ceo ?? ''],
    ['사업자번호', data.supplier.bizNo ?? '', '사업자번호', data.buyer.bizNo ?? ''],
    ['주소', data.supplier.address ?? '', '주소', data.buyer.address ?? ''],
    ['전화', data.supplier.tel ?? '', '전화', data.buyer.tel ?? ''],
  ]

  autoTable(doc, {
    startY: y,
    head: [['', '공급자', '', '공급받는자']],
    body: infoRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: fontName },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 25, fillColor: LIGHT_GRAY, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 25, fillColor: LIGHT_GRAY, fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 65 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 6

  // --- Items table ---
  const itemHead = [['No', '품명', '규격', '수량', '단가', '금액', '비고']]
  const itemBody = data.items.map((item) => [
    String(item.no),
    item.itemName,
    item.spec ?? '',
    fmt(item.qty),
    fmt(item.unitPrice),
    fmt(item.amount),
    item.remark ?? '',
  ])

  autoTable(doc, {
    startY: y,
    head: itemHead,
    body: itemBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: fontName },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      halign: 'center',
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 27 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 2

  // --- Total amount row ---
  autoTable(doc, {
    startY: y,
    body: [['', '합 계', '', '', '', fmt(data.totalAmount), '']],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, font: fontName },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 45, halign: 'center', fontStyle: 'bold', fillColor: LIGHT_GRAY },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 27 },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  })

  y = (doc as any).lastAutoTable.finalY + 6

  // --- Description ---
  if (data.description) {
    doc.setFontSize(9)
    doc.text(`비고: ${data.description}`, PAGE_MARGIN, y)
  }

  // --- Page numbers ---
  addPageNumbers(doc, fontName)

  doc.save(`거래명세표_${data.statementNo}.pdf`)
}

// ---------------------------------------------------------------------------
// Shared: page numbers
// ---------------------------------------------------------------------------

function addPageNumbers(doc: InstanceType<typeof import('jspdf').default>, fontName?: string) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    if (fontName && fontName !== 'helvetica') doc.setFont(fontName)
    doc.text(`${i} / ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, {
      align: 'center',
    })
  }
}

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
  supplier: {
    name: string
    bizNo?: string
    ceo?: string
    address?: string
    tel?: string
    bankName?: string
    bankAccount?: string
    bankHolder?: string
  }
  buyer: { name: string; bizNo?: string; ceo?: string; address?: string; tel?: string }
  items: {
    no: number
    barcode?: string
    itemName: string
    spec?: string
    unit?: string
    qty: number
    unitPrice: number
    supplyAmount: number
    taxAmount: number
    remark?: string
  }[]
  totalQty: number
  totalSupply: number
  totalTax: number
  totalAmount: number
  previousBalance?: number
  nextBalance?: number
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
    head: [['공급가액', '세액', '합계금액']],
    body: [[fmtNumber(data.totalSupply), fmtNumber(data.totalTax), fmtNumber(data.totalAmount)]],
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
// 3. 거래명세서 (Transaction Statement) – 한국식 좌/우 복사 양식
// ---------------------------------------------------------------------------

const STATEMENT_ITEM_ROWS = 15

/** 숫자를 한글 금액으로 변환 (예: 12300 → "일만이천삼백") */
function numberToKorean(n: number): string {
  if (n === 0) return '영'
  const d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const s = ['', '십', '백', '천']
  const b = ['', '만', '억', '조']
  let result = ''
  let bi = 0
  let num = Math.floor(Math.abs(n))
  while (num > 0) {
    const chunk = num % 10000
    if (chunk > 0) {
      let cs = ''
      let c = chunk
      for (let i = 0; c > 0; i++) {
        const digit = c % 10
        if (digit > 0) cs = (i > 0 && digit === 1 ? '' : d[digit]) + s[i] + cs
        c = Math.floor(c / 10)
      }
      result = cs + b[bi] + result
    }
    num = Math.floor(num / 10000)
    bi++
  }
  return result
}

/** 거래명세서 한 부(copy)를 지정 영역에 그리기 */
function drawStatementCopy(
  doc: InstanceType<typeof import('jspdf').jsPDF>,
  fontName: string,
  data: TransactionStatementPDFData,
  ox: number,
  cw: number,
  copyLabel: string
) {
  const rh = 6
  const fs = 7

  const cell = (
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    opts?: { align?: 'left' | 'center' | 'right'; fontSize?: number; fill?: boolean }
  ) => {
    const f = opts?.fontSize ?? fs
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.2)
    if (opts?.fill) {
      doc.setFillColor(235, 235, 235)
      doc.rect(x, y, w, h, 'FD')
    } else {
      doc.rect(x, y, w, h)
    }
    doc.setFontSize(f)
    doc.setFont(fontName, 'normal')
    const px = 1.5
    const tx = opts?.align === 'center' ? x + w / 2 : opts?.align === 'right' ? x + w - px : x + px
    const ty = y + h / 2 + f * 0.13
    doc.text(String(text ?? ''), tx, ty, { align: opts?.align ?? 'left' })
  }

  let y = 7

  // ═══ Title block ═══
  doc.setLineWidth(0.5)
  doc.setDrawColor(0, 0, 0)
  doc.rect(ox, y, cw, 12)
  doc.setFontSize(15)
  doc.setFont(fontName, 'normal')
  doc.text('거  래  명  세  서', ox + cw / 2, y + 6, { align: 'center' })
  doc.setFontSize(7)
  doc.text(`(${copyLabel})`, ox + cw / 2, y + 10, { align: 'center' })
  y += 12

  // ═══ Serial number ═══
  doc.setFontSize(7)
  doc.text(`일련번호: ${data.statementNo}`, ox + cw - 1.5, y + 4, { align: 'right' })
  y += 5

  // ═══ Company info grid ═══
  const lw = 22
  const halfW = Math.floor(cw / 2)
  const lw2 = 24

  // Row 1: TEL | 사업자등록번호
  cell(ox, y, lw, rh, 'TEL', { align: 'center', fill: true })
  cell(ox + lw, y, halfW - lw, rh, data.supplier.tel || '')
  cell(ox + halfW, y, lw2, rh, '사업자등록번호', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + halfW + lw2, y, cw - halfW - lw2, rh, data.supplier.bizNo || '')
  y += rh

  // Row 2: 상호(법인명) | 성명
  cell(ox, y, lw, rh, '상호(법인명)', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + lw, y, halfW - lw, rh, data.supplier.name)
  cell(ox + halfW, y, lw2, rh, '성명', { align: 'center', fill: true })
  cell(ox + halfW + lw2, y, cw - halfW - lw2, rh, `${data.supplier.ceo || ''}     (인)`)
  y += rh

  // Row 3: 주소
  cell(ox, y, lw, rh, '주소', { align: 'center', fill: true })
  cell(ox + lw, y, cw - lw, rh, data.supplier.address || '', { fontSize: 6.5 })
  y += rh

  // Row 4: 공급받는자
  cell(ox, y, lw, rh, '공급받는자', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + lw, y, cw - lw, rh, `${data.buyer.name}  귀하`)
  y += rh

  // ═══ Amount row ═══
  y += 0.5
  const amountKo = numberToKorean(Math.floor(data.totalAmount))
  const amountFmt = fmtNumber(Math.floor(data.totalAmount))
  cell(ox, y, lw, rh + 1, '금    액', { align: 'center', fill: true, fontSize: 8 })
  cell(ox + lw, y, cw - lw, rh + 1, `일금  ${amountKo}원정  (W${amountFmt})`, { fontSize: 7.5 })
  y += rh + 1

  // ═══ Item table ═══
  y += 0.5
  const colW = [17, 26, 13, 9, 11, 15, 17, 15, 16]
  colW[colW.length - 1] += cw - colW.reduce((a, b) => a + b, 0) // 보정
  const colH = ['바코드', '품목명', '규격', '단위', '수량', '단가', '공급가액', '부가세', '적요']
  const colA: ('left' | 'center' | 'right')[] = [
    'left',
    'left',
    'left',
    'center',
    'right',
    'right',
    'right',
    'right',
    'left',
  ]

  // Header row
  let cx = ox
  for (let i = 0; i < colW.length; i++) {
    cell(cx, y, colW[i], rh, colH[i], { align: 'center', fill: true, fontSize: 6 })
    cx += colW[i]
  }
  y += rh

  // Data rows (fixed number of rows)
  for (let r = 0; r < STATEMENT_ITEM_ROWS; r++) {
    const item = data.items[r]
    cx = ox
    if (item) {
      const vals = [
        item.barcode || '',
        item.itemName,
        item.spec || '',
        item.unit || '',
        fmtNumber(item.qty),
        fmtNumber(item.unitPrice),
        fmtNumber(item.supplyAmount),
        fmtNumber(item.taxAmount),
        item.remark || '',
      ]
      for (let i = 0; i < colW.length; i++) {
        cell(cx, y, colW[i], rh, vals[i], { align: colA[i], fontSize: 6 })
        cx += colW[i]
      }
    } else {
      for (let i = 0; i < colW.length; i++) {
        cell(cx, y, colW[i], rh, '')
        cx += colW[i]
      }
    }
    y += rh
  }

  // ═══ Summary row ═══
  const sumLabels = ['수량', '공급가액', 'VAT', '합계']
  const sumValues = [
    fmtNumber(data.totalQty),
    fmtNumber(data.totalSupply),
    fmtNumber(data.totalTax),
    fmtNumber(data.totalAmount),
  ]
  const sumH = rh + 1
  const sumLW = 16
  const segW = cw / 4
  cx = ox
  for (let i = 0; i < 4; i++) {
    const sw = i < 3 ? Math.floor(segW) : cw - Math.floor(segW) * 3 // 마지막 보정
    cell(cx, y, sumLW, sumH, sumLabels[i], { align: 'center', fill: true, fontSize: 6.5 })
    cell(cx + sumLW, y, sw - sumLW, sumH, sumValues[i], { align: 'right', fontSize: 7 })
    cx += sw
  }
  y += sumH

  // ═══ Bank info ═══
  y += 2
  doc.setFontSize(7)
  doc.setFont(fontName, 'normal')
  if (data.supplier.bankName) {
    doc.text(
      `입금계좌:  ${data.supplier.bankName}  ${data.supplier.bankAccount || ''}  ${data.supplier.bankHolder || ''}`,
      ox + 1.5,
      y + 2
    )
  }

  // ═══ Previous/Next balance + Received stamp ═══
  y += 6
  const balLW = 12
  const balVW = 30
  cell(ox, y, balLW, rh, '전잔', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + balLW, y, balVW, rh, data.previousBalance != null ? fmtNumber(data.previousBalance) : '', {
    align: 'right',
  })
  cell(ox + balLW + balVW, y, balLW, rh, '후잔', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + balLW * 2 + balVW, y, balVW, rh, data.nextBalance != null ? fmtNumber(data.nextBalance) : '', {
    align: 'right',
  })
  cell(ox + cw - 22, y, 22, rh, '인수       (인)', { align: 'center' })
}

export async function generateTransactionStatementPDF(data: TransactionStatementPDFData) {
  const { doc, fontName, pageWidth, pageHeight } = await createPDFDocument({ orientation: 'landscape' })

  const margin = 5
  const gap = 9
  const copyWidth = (pageWidth - 2 * margin - gap) / 2

  // 15행 초과 시 페이지 분할
  const totalPages = Math.ceil(data.items.length / STATEMENT_ITEM_ROWS) || 1
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage('a4', 'landscape')
    const pageItems = data.items.slice(page * STATEMENT_ITEM_ROWS, (page + 1) * STATEMENT_ITEM_ROWS)
    const isLastPage = page === totalPages - 1
    const pageData: TransactionStatementPDFData = {
      ...data,
      items: pageItems,
      // 합계는 마지막 페이지에서만 표시, 중간 페이지는 0으로
      totalQty: isLastPage ? data.totalQty : 0,
      totalSupply: isLastPage ? data.totalSupply : 0,
      totalTax: isLastPage ? data.totalTax : 0,
      totalAmount: isLastPage ? data.totalAmount : 0,
    }

    drawStatementCopy(doc, fontName, pageData, margin, copyWidth, '공급자 보관용')
    drawStatementCopy(doc, fontName, pageData, margin + copyWidth + gap, copyWidth, '공급받는자 보관용')

    // Center dashed cutting line
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.15)
    const centerX = pageWidth / 2
    for (let dy = 5; dy < pageHeight - 5; dy += 4) {
      doc.line(centerX, dy, centerX, Math.min(dy + 2, pageHeight - 5))
    }
  }

  doc.save(`거래명세서_${data.statementNo}.pdf`)
}

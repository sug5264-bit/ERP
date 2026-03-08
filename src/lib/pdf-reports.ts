import {
  createPDFDocument,
  addPageNumbers,
  getLastTableY,
  PDF_COLORS,
  PAGE_MARGIN,
  defaultHeadStyles,
  labelColumnStyle,
  fmtNumber,
  fmtPrintDate,
} from '@/lib/export/pdf-base'

// ---------------------------------------------------------------------------
// 공통 유틸리티
// ---------------------------------------------------------------------------

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

/** 금액을 자릿수 배열로 분해 (억/천만/백만/십만/만/천/백/십/일) */
function splitAmountDigits(amount: number, digitCount: number): string[] {
  const str = Math.floor(Math.abs(amount)).toString()
  const padded = str.padStart(digitCount, ' ')
  return padded.split('').map((c) => (c === ' ' ? '' : c))
}

/** 셀 그리기 헬퍼 (직선 그리드 셀) */
type CellOpts = {
  align?: 'left' | 'center' | 'right'
  fontSize?: number
  fill?: boolean
  fillColor?: [number, number, number]
  bold?: boolean
  textColor?: [number, number, number]
  borderWidth?: number
}

function makeCell(
  doc: InstanceType<typeof import('jspdf').jsPDF>,
  fontName: string,
  defaultFontSize: number
) {
  return (x: number, y: number, w: number, h: number, text: string, opts?: CellOpts) => {
    const f = opts?.fontSize ?? defaultFontSize
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(opts?.borderWidth ?? 0.2)
    if (opts?.fill || opts?.fillColor) {
      const fc = opts?.fillColor ?? [235, 235, 235] as [number, number, number]
      doc.setFillColor(fc[0], fc[1], fc[2])
      doc.rect(x, y, w, h, 'FD')
    } else {
      doc.rect(x, y, w, h)
    }
    doc.setFontSize(f)
    doc.setFont(fontName, 'normal')
    if (opts?.textColor) doc.setTextColor(opts.textColor[0], opts.textColor[1], opts.textColor[2])
    else doc.setTextColor(0, 0, 0)
    const px = 1.5
    const tx = opts?.align === 'center' ? x + w / 2 : opts?.align === 'right' ? x + w - px : x + px
    const ty = y + h / 2 + f * 0.13
    doc.text(String(text ?? ''), tx, ty, { align: opts?.align ?? 'left' })
  }
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

export interface PurchaseOrderPDFData {
  orderNo: string
  orderDate: string
  deliveryDate?: string
  company: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  supplier: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  items: {
    no: number
    itemName: string
    spec?: string
    unit?: string
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
  paymentTerms?: string
  deliveryLocation?: string
}

export interface VoucherPDFData {
  voucherNo: string
  voucherDate: string
  voucherType: string
  description?: string
  company: { name: string }
  createdBy: string
  approvedBy?: string
  details: {
    lineNo: number
    accountName: string
    accountCode: string
    debitAmount: number
    creditAmount: number
    description?: string
  }[]
  totalDebit: number
  totalCredit: number
}

export interface SalesOrderPDFData {
  orderNo: string
  orderDate: string
  deliveryDate?: string
  company: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  partner: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  items: {
    no: number
    itemName: string
    spec?: string
    unit?: string
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
  paymentTerms?: string
  deliveryAddress?: string
}

// ---------------------------------------------------------------------------
// 1. 견적서 (Quotation) — 한국 표준 양식
// ---------------------------------------------------------------------------

export async function generateQuotationPDF(data: QuotationPDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()
  const cell = makeCell(doc, fontName, 8)

  let y = 12

  // --- 제목 ---
  doc.setFontSize(22)
  doc.setFont(fontName, 'normal')
  doc.text('견   적   서', pageWidth / 2, y, { align: 'center' })
  y += 4

  // --- 부제 ---
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(`(Quotation)`, pageWidth / 2, y + 3, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 8

  // --- 수신처 / 메타정보 ---
  const metaLeft = PAGE_MARGIN
  const metaRight = pageWidth - PAGE_MARGIN
  doc.setFontSize(10)
  doc.text(`${data.partner.name}  귀하`, metaLeft, y)
  doc.setFontSize(8)
  doc.text(`견적번호: ${data.quotationNo}`, metaRight, y, { align: 'right' })
  y += 5
  doc.text(`견적일자: ${data.quotationDate}`, metaRight, y, { align: 'right' })
  if (data.validUntil) {
    y += 4
    doc.text(`유효기한: ${data.validUntil}`, metaRight, y, { align: 'right' })
  }
  y += 6

  // --- 금액 표시 (한글 + 숫자) ---
  const amountKo = numberToKorean(Math.floor(data.totalAmount))
  const rh = 8
  cell(PAGE_MARGIN, y, 28, rh, '합 계 금 액', { align: 'center', fill: true, fontSize: 9 })
  cell(PAGE_MARGIN + 28, y, pageWidth - 2 * PAGE_MARGIN - 28, rh,
    `일금  ${amountKo}원정  (₩${fmtNumber(data.totalAmount)})`, { fontSize: 10 })
  y += rh + 2

  // --- 아래와 같이 견적합니다 ---
  doc.setFontSize(9)
  doc.text('아래와 같이 견적합니다.', PAGE_MARGIN, y + 3)
  y += 8

  // --- 공급자 / 공급받는자 정보 ---
  const infoW = (pageWidth - 2 * PAGE_MARGIN - 4) / 2
  const labelW = 24
  const valW = infoW - labelW
  const irh = 6.5

  // 공급자
  cell(PAGE_MARGIN, y, infoW, 7, '공  급  자', { align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 8 })
  cell(PAGE_MARGIN + infoW + 4, y, infoW, 7, '공 급 받 는 자', { align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 8 })
  y += 7

  const companyRows = [
    ['상 호', data.company.name, '상 호', data.partner.name],
    ['대 표 자', `${data.company.ceo ?? ''}          (인)`, '대 표 자', data.partner.ceo ?? ''],
    ['사업자번호', data.company.bizNo ?? '', '사업자번호', data.partner.bizNo ?? ''],
    ['주 소', data.company.address ?? '', '주 소', data.partner.address ?? ''],
    ['전 화', data.company.tel ?? '', '전 화', data.partner.tel ?? ''],
  ]
  for (const row of companyRows) {
    cell(PAGE_MARGIN, y, labelW, irh, row[0], { align: 'center', fill: true, fontSize: 7 })
    cell(PAGE_MARGIN + labelW, y, valW, irh, row[1], { fontSize: 7.5 })
    cell(PAGE_MARGIN + infoW + 4, y, labelW, irh, row[2], { align: 'center', fill: true, fontSize: 7 })
    cell(PAGE_MARGIN + infoW + 4 + labelW, y, valW, irh, row[3], { fontSize: 7.5 })
    y += irh
  }
  y += 4

  // --- 합계 요약 ---
  autoTable({
    ...summaryTableStyles,
    startY: y,
    head: [['공급가액', '부가세(VAT)', '합계금액']],
    body: [[fmtNumber(data.totalSupply), fmtNumber(data.totalTax), fmtNumber(data.totalAmount)]],
    columnStyles: {
      2: { halign: 'right' as const, fontStyle: 'bold' as const },
    },
  })
  y = getLastTableY(doc) + 3

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
  y = getLastTableY(doc) + 6

  // --- 비고 ---
  if (data.description) {
    doc.setFontSize(9)
    doc.text(`※ 비고: ${data.description}`, PAGE_MARGIN, y)
    y += 6
  }

  // --- 특기사항 ---
  y += 2
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('※ 본 견적서의 유효기간은 견적일로부터 30일입니다.', PAGE_MARGIN, y)
  y += 4
  doc.text('※ 상기 금액은 부가가치세 포함 금액입니다.', PAGE_MARGIN, y)
  doc.setTextColor(0, 0, 0)

  addPageNumbers(doc, fontName, { prefix: `출력일: ${fmtPrintDate()}` })
  doc.save(`견적서_${data.quotationNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 2. 세금계산서 (Tax Invoice) — 국세청 표준 양식
// ---------------------------------------------------------------------------

export async function generateTaxInvoicePDF(data: TaxInvoicePDFData) {
  const { doc, fontName, pageWidth } = await createPDFDocument()
  const cell = makeCell(doc, fontName, 7)

  const M = PAGE_MARGIN
  const W = pageWidth - 2 * M
  const rh = 6.5
  let y = 10

  // --- 외곽 테두리 ---
  doc.setDrawColor(0, 0, 200)
  doc.setLineWidth(1)
  doc.rect(M - 2, y - 2, W + 4, 4 + rh)

  // --- 제목 행 ---
  doc.setFontSize(16)
  doc.setFont(fontName, 'normal')
  doc.setTextColor(0, 0, 200)
  doc.text('세  금  계  산  서', pageWidth / 2, y + rh / 2 + 1, { align: 'center' })
  doc.setFontSize(7)
  doc.text('(공급자 보관용)', pageWidth / 2, y + rh + 1, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += rh + 4

  // --- 공급자 / 공급받는자 정보 그리드 ---
  const halfW = W / 2
  const labelW1 = 24
  const subLabelW = 18
  const bizNoW = halfW - labelW1

  // 공급자 헤더
  cell(M, y, 12, rh * 5, '공\n급\n자', { align: 'center', fill: true, fillColor: [220, 230, 255], fontSize: 7 })

  // 사업자등록번호
  cell(M + 12, y, labelW1, rh, '등록번호', { align: 'center', fill: true, fontSize: 6.5 })
  // 사업자번호를 3-2-5 포맷으로 분리
  const sBizNo = data.supplier.bizNo.replace(/-/g, '')
  const bizNoCellW = (halfW - 12 - labelW1) / 3
  cell(M + 12 + labelW1, y, bizNoCellW, rh, sBizNo.substring(0, 3), { align: 'center' })
  cell(M + 12 + labelW1 + bizNoCellW, y, bizNoCellW, rh, sBizNo.substring(3, 5), { align: 'center' })
  cell(M + 12 + labelW1 + bizNoCellW * 2, y, bizNoCellW, rh, sBizNo.substring(5, 10), { align: 'center' })

  // 공급받는자 헤더
  cell(M + halfW, y, 12, rh * 5, '공\n급\n받\n는\n자', { align: 'center', fill: true, fillColor: [220, 230, 255], fontSize: 6 })
  cell(M + halfW + 12, y, labelW1, rh, '등록번호', { align: 'center', fill: true, fontSize: 6.5 })
  const bBizNo = data.buyer.bizNo.replace(/-/g, '')
  cell(M + halfW + 12 + labelW1, y, bizNoCellW, rh, bBizNo.substring(0, 3), { align: 'center' })
  cell(M + halfW + 12 + labelW1 + bizNoCellW, y, bizNoCellW, rh, bBizNo.substring(3, 5), { align: 'center' })
  cell(M + halfW + 12 + labelW1 + bizNoCellW * 2, y, bizNoCellW, rh, bBizNo.substring(5, 10), { align: 'center' })
  y += rh

  // 상호 / 성명
  const nameValW = halfW - 12 - labelW1 - subLabelW
  cell(M + 12, y, subLabelW, rh, '상 호', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + 12 + subLabelW, y, nameValW / 2, rh, data.supplier.name, { fontSize: 7 })
  cell(M + 12 + subLabelW + nameValW / 2, y, subLabelW, rh, '성 명', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + 12 + subLabelW * 2 + nameValW / 2, y, halfW - 12 - subLabelW * 2 - nameValW / 2, rh, `${data.supplier.ceo}  (인)`, { fontSize: 7 })

  cell(M + halfW + 12, y, subLabelW, rh, '상 호', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + halfW + 12 + subLabelW, y, nameValW / 2, rh, data.buyer.name, { fontSize: 7 })
  cell(M + halfW + 12 + subLabelW + nameValW / 2, y, subLabelW, rh, '성 명', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + halfW + 12 + subLabelW * 2 + nameValW / 2, y, halfW - 12 - subLabelW * 2 - nameValW / 2, rh, data.buyer.ceo, { fontSize: 7 })
  y += rh

  // 주소
  cell(M + 12, y, subLabelW, rh, '사업장주소', { align: 'center', fill: true, fontSize: 5.5 })
  cell(M + 12 + subLabelW, y, halfW - 12 - subLabelW, rh, data.supplier.address, { fontSize: 6.5 })
  cell(M + halfW + 12, y, subLabelW, rh, '사업장주소', { align: 'center', fill: true, fontSize: 5.5 })
  cell(M + halfW + 12 + subLabelW, y, halfW - 12 - subLabelW, rh, data.buyer.address, { fontSize: 6.5 })
  y += rh

  // 업태
  cell(M + 12, y, subLabelW, rh, '업 태', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + 12 + subLabelW, y, nameValW / 2, rh, data.supplier.bizType ?? '', { fontSize: 7 })
  cell(M + 12 + subLabelW + nameValW / 2, y, subLabelW, rh, '종 목', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + 12 + subLabelW * 2 + nameValW / 2, y, halfW - 12 - subLabelW * 2 - nameValW / 2, rh, data.supplier.bizItem ?? '', { fontSize: 7 })

  cell(M + halfW + 12, y, subLabelW, rh, '업 태', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + halfW + 12 + subLabelW, y, nameValW / 2, rh, data.buyer.bizType ?? '', { fontSize: 7 })
  cell(M + halfW + 12 + subLabelW + nameValW / 2, y, subLabelW, rh, '종 목', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + halfW + 12 + subLabelW * 2 + nameValW / 2, y, halfW - 12 - subLabelW * 2 - nameValW / 2, rh, data.buyer.bizItem ?? '', { fontSize: 7 })
  y += rh

  // 이메일 (빈칸)
  cell(M + 12, y, subLabelW, rh, 'E-Mail', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + 12 + subLabelW, y, halfW - 12 - subLabelW, rh, '', { fontSize: 7 })
  cell(M + halfW + 12, y, subLabelW, rh, 'E-Mail', { align: 'center', fill: true, fontSize: 6.5 })
  cell(M + halfW + 12 + subLabelW, y, halfW - 12 - subLabelW, rh, '', { fontSize: 7 })
  y += rh + 2

  // --- 작성일자 / 공급가액 / 세액 ---
  const amtLabelW = 18
  const dateW = 40
  const amtDigits = splitAmountDigits(data.totalSupply, 10)
  const taxDigits = splitAmountDigits(data.totalTax, 10)
  const digitLabels = ['십억', '억', '천만', '백만', '십만', '만', '천', '백', '십', '일']
  const digitW = (W - amtLabelW - dateW) / 20

  // 자릿수 헤더
  cell(M, y, amtLabelW, rh - 1, '작성일자', { align: 'center', fill: true, fontSize: 6 })
  cell(M + amtLabelW, y, dateW, rh - 1, data.invoiceDate, { align: 'center', fontSize: 7 })
  cell(M + amtLabelW + dateW, y, digitW * 10, rh - 1, '공급가액', { align: 'center', fill: true, fontSize: 6 })
  cell(M + amtLabelW + dateW + digitW * 10, y, digitW * 10, rh - 1, '세     액', { align: 'center', fill: true, fontSize: 6 })
  y += rh - 1

  // 자릿수 라벨
  for (let i = 0; i < 10; i++) {
    cell(M + amtLabelW + dateW + digitW * i, y, digitW, rh - 2, digitLabels[i], { align: 'center', fill: true, fontSize: 4.5 })
    cell(M + amtLabelW + dateW + digitW * 10 + digitW * i, y, digitW, rh - 2, digitLabels[i], { align: 'center', fill: true, fontSize: 4.5 })
  }
  y += rh - 2

  // 자릿수 값
  cell(M, y, amtLabelW, rh, '금 액', { align: 'center', fill: true, fontSize: 7 })
  cell(M + amtLabelW, y, dateW, rh, `₩${fmtNumber(data.totalAmount)}`, { align: 'center', fontSize: 8 })
  for (let i = 0; i < 10; i++) {
    cell(M + amtLabelW + dateW + digitW * i, y, digitW, rh, amtDigits[i], { align: 'center', fontSize: 7 })
    cell(M + amtLabelW + dateW + digitW * 10 + digitW * i, y, digitW, rh, taxDigits[i], { align: 'center', fontSize: 7 })
  }
  y += rh + 2

  // --- 품목 테이블 ---
  const itemCols = [14, 14, 40, 22, 18, 24, 26, 24]
  const itemTotal = itemCols.reduce((a, b) => a + b, 0)
  const scale = W / itemTotal
  const scaledCols = itemCols.map((c) => c * scale)

  const itemHeaders = ['월', '일', '품    목', '규 격', '수 량', '단    가', '공급가액', '세  액']
  let cx = M
  for (let i = 0; i < itemHeaders.length; i++) {
    cell(cx, y, scaledCols[i], rh, itemHeaders[i], { align: 'center', fill: true, fontSize: 6.5 })
    cx += scaledCols[i]
  }
  y += rh

  // 4행 고정 (빈 행 포함)
  const itemRows = Math.max(4, data.items.length)
  for (let r = 0; r < itemRows; r++) {
    const item = data.items[r]
    cx = M
    if (item) {
      const vals = [item.month, item.day, item.itemName, item.spec ?? '', fmtNumber(item.qty), fmtNumber(item.unitPrice), fmtNumber(item.supplyAmount), fmtNumber(item.taxAmount)]
      const aligns: CellOpts['align'][] = ['center', 'center', 'left', 'left', 'right', 'right', 'right', 'right']
      for (let i = 0; i < scaledCols.length; i++) {
        cell(cx, y, scaledCols[i], rh, vals[i], { align: aligns[i], fontSize: 7 })
        cx += scaledCols[i]
      }
    } else {
      for (let i = 0; i < scaledCols.length; i++) {
        cell(cx, y, scaledCols[i], rh, '')
        cx += scaledCols[i]
      }
    }
    y += rh
  }

  // 합계 행
  cx = M
  cell(cx, y, scaledCols[0] + scaledCols[1], rh, '합    계', { align: 'center', fill: true, fontSize: 7 })
  cx += scaledCols[0] + scaledCols[1]
  cell(cx, y, scaledCols[2], rh, '')
  cx += scaledCols[2]
  cell(cx, y, scaledCols[3], rh, '')
  cx += scaledCols[3]
  cell(cx, y, scaledCols[4], rh, '')
  cx += scaledCols[4]
  cell(cx, y, scaledCols[5], rh, '')
  cx += scaledCols[5]
  cell(cx, y, scaledCols[6], rh, fmtNumber(data.totalSupply), { align: 'right', fontSize: 7 })
  cx += scaledCols[6]
  cell(cx, y, scaledCols[7], rh, fmtNumber(data.totalTax), { align: 'right', fontSize: 7 })
  y += rh + 2

  // --- 현금/수표/어음/외상 ---
  const payW = W / 4
  cell(M, y, payW, rh, '현    금', { align: 'center', fill: true, fontSize: 7 })
  cell(M + payW, y, payW, rh, '수    표', { align: 'center', fill: true, fontSize: 7 })
  cell(M + payW * 2, y, payW, rh, '어    음', { align: 'center', fill: true, fontSize: 7 })
  cell(M + payW * 3, y, payW, rh, '외 상 미 수 금', { align: 'center', fill: true, fontSize: 7 })
  y += rh
  cell(M, y, payW, rh, '', { align: 'right' })
  cell(M + payW, y, payW, rh, '', { align: 'right' })
  cell(M + payW * 2, y, payW, rh, '', { align: 'right' })
  cell(M + payW * 3, y, payW, rh, fmtNumber(data.totalAmount), { align: 'right', fontSize: 7 })
  y += rh + 6

  // --- 푸터 ---
  doc.setFontSize(10)
  doc.setFont(fontName, 'normal')
  doc.text('이 금액을  ☐ 영수  ☐ 청구  함', pageWidth / 2, y, { align: 'center' })

  addPageNumbers(doc, fontName, { prefix: `출력일: ${fmtPrintDate()}` })
  doc.save(`세금계산서_${data.invoiceNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 3. 거래명세서 (Transaction Statement) — 한국식 좌/우 복사 양식
// ---------------------------------------------------------------------------

const STATEMENT_ITEM_ROWS = 15

function drawStatementCopy(
  doc: InstanceType<typeof import('jspdf').jsPDF>,
  fontName: string,
  data: TransactionStatementPDFData,
  ox: number,
  cw: number,
  copyLabel: string
) {
  const rh = 6
  const cell = makeCell(doc, fontName, 7)

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

  cell(ox, y, lw, rh, 'TEL', { align: 'center', fill: true })
  cell(ox + lw, y, halfW - lw, rh, data.supplier.tel || '')
  cell(ox + halfW, y, lw2, rh, '사업자등록번호', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + halfW + lw2, y, cw - halfW - lw2, rh, data.supplier.bizNo || '')
  y += rh

  cell(ox, y, lw, rh, '상호(법인명)', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + lw, y, halfW - lw, rh, data.supplier.name)
  cell(ox + halfW, y, lw2, rh, '성명', { align: 'center', fill: true })
  cell(ox + halfW + lw2, y, cw - halfW - lw2, rh, `${data.supplier.ceo || ''}     (인)`)
  y += rh

  cell(ox, y, lw, rh, '주소', { align: 'center', fill: true })
  cell(ox + lw, y, cw - lw, rh, data.supplier.address || '', { fontSize: 6.5 })
  y += rh

  cell(ox, y, lw, rh, '공급받는자', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + lw, y, cw - lw, rh, `${data.buyer.name}  귀하`)
  y += rh

  // ═══ Amount row ═══
  y += 0.5
  const amountKo = numberToKorean(Math.floor(data.totalAmount))
  const amountFmt = fmtNumber(Math.floor(data.totalAmount))
  cell(ox, y, lw, rh + 1, '금    액', { align: 'center', fill: true, fontSize: 8 })
  cell(ox + lw, y, cw - lw, rh + 1, `일금  ${amountKo}원정  (₩${amountFmt})`, { fontSize: 7.5 })
  y += rh + 1

  // ═══ Item table ═══
  y += 0.5
  const colW = [17, 26, 13, 9, 11, 15, 17, 15, 16]
  colW[colW.length - 1] += cw - colW.reduce((a, b) => a + b, 0)
  const colH = ['바코드', '품목명', '규격', '단위', '수량', '단가', '공급가액', '부가세', '적요']
  const colA: ('left' | 'center' | 'right')[] = ['left', 'left', 'left', 'center', 'right', 'right', 'right', 'right', 'left']

  let cx = ox
  for (let i = 0; i < colW.length; i++) {
    cell(cx, y, colW[i], rh, colH[i], { align: 'center', fill: true, fontSize: 6 })
    cx += colW[i]
  }
  y += rh

  for (let r = 0; r < STATEMENT_ITEM_ROWS; r++) {
    const item = data.items[r]
    cx = ox
    if (item) {
      const vals = [item.barcode || '', item.itemName, item.spec || '', item.unit || '', fmtNumber(item.qty), fmtNumber(item.unitPrice), fmtNumber(item.supplyAmount), fmtNumber(item.taxAmount), item.remark || '']
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
  const sumValues = [fmtNumber(data.totalQty), fmtNumber(data.totalSupply), fmtNumber(data.totalTax), fmtNumber(data.totalAmount)]
  const sumH = rh + 1
  const sumLW = 16
  const segW = cw / 4
  cx = ox
  for (let i = 0; i < 4; i++) {
    const sw = i < 3 ? Math.floor(segW) : cw - Math.floor(segW) * 3
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
      ox + 1.5, y + 2
    )
  }

  // ═══ Previous/Next balance + Received stamp ═══
  y += 6
  const balLW = 12
  const balVW = 30
  cell(ox, y, balLW, rh, '전잔', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + balLW, y, balVW, rh, data.previousBalance != null ? fmtNumber(data.previousBalance) : '', { align: 'right' })
  cell(ox + balLW + balVW, y, balLW, rh, '후잔', { align: 'center', fill: true, fontSize: 6 })
  cell(ox + balLW * 2 + balVW, y, balVW, rh, data.nextBalance != null ? fmtNumber(data.nextBalance) : '', { align: 'right' })
  cell(ox + cw - 22, y, 22, rh, '인수       (인)', { align: 'center' })
}

export async function generateTransactionStatementPDF(data: TransactionStatementPDFData) {
  const { doc, fontName, pageWidth, pageHeight } = await createPDFDocument({ orientation: 'landscape' })

  const margin = 5
  const gap = 9
  const copyWidth = (pageWidth - 2 * margin - gap) / 2

  const totalPages = Math.ceil(data.items.length / STATEMENT_ITEM_ROWS) || 1
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage('a4', 'landscape')
    const pageItems = data.items.slice(page * STATEMENT_ITEM_ROWS, (page + 1) * STATEMENT_ITEM_ROWS)
    const isLastPage = page === totalPages - 1
    const pageData: TransactionStatementPDFData = {
      ...data,
      items: pageItems,
      totalQty: isLastPage ? data.totalQty : 0,
      totalSupply: isLastPage ? data.totalSupply : 0,
      totalTax: isLastPage ? data.totalTax : 0,
      totalAmount: isLastPage ? data.totalAmount : 0,
    }

    drawStatementCopy(doc, fontName, pageData, margin, copyWidth, '공급자 보관용')
    drawStatementCopy(doc, fontName, pageData, margin + copyWidth + gap, copyWidth, '공급받는자 보관용')

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.15)
    const centerX = pageWidth / 2
    for (let dy = 5; dy < pageHeight - 5; dy += 4) {
      doc.line(centerX, dy, centerX, Math.min(dy + 2, pageHeight - 5))
    }
  }

  doc.save(`거래명세서_${data.statementNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 4. 발주서 (Purchase Order) — 한국 표준 양식
// ---------------------------------------------------------------------------

export async function generatePurchaseOrderPDF(data: PurchaseOrderPDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()
  const cell = makeCell(doc, fontName, 8)

  let y = 12

  // --- 제목 ---
  doc.setFontSize(22)
  doc.setFont(fontName, 'normal')
  doc.text('발   주   서', pageWidth / 2, y, { align: 'center' })
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text('(Purchase Order)', pageWidth / 2, y + 2, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 8

  // --- 수신처 ---
  doc.setFontSize(10)
  doc.text(`${data.supplier.name}  귀하`, PAGE_MARGIN, y)
  doc.setFontSize(8)
  doc.text(`발주번호: ${data.orderNo}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  y += 5
  doc.text(`발주일자: ${data.orderDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  if (data.deliveryDate) {
    y += 4
    doc.text(`납기일자: ${data.deliveryDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  }
  y += 6

  // --- 금액 ---
  const amountKo = numberToKorean(Math.floor(data.totalAmount))
  const rh = 8
  cell(PAGE_MARGIN, y, 28, rh, '합 계 금 액', { align: 'center', fill: true, fontSize: 9 })
  cell(PAGE_MARGIN + 28, y, pageWidth - 2 * PAGE_MARGIN - 28, rh,
    `일금  ${amountKo}원정  (₩${fmtNumber(data.totalAmount)})`, { fontSize: 10 })
  y += rh + 2

  doc.setFontSize(9)
  doc.text('아래와 같이 발주합니다.', PAGE_MARGIN, y + 3)
  y += 8

  // --- 발주처/공급처 정보 ---
  const infoW = (pageWidth - 2 * PAGE_MARGIN - 4) / 2
  const labelW = 24
  const irh = 6.5

  cell(PAGE_MARGIN, y, infoW, 7, '발  주  처', { align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 8 })
  cell(PAGE_MARGIN + infoW + 4, y, infoW, 7, '공  급  처', { align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 8 })
  y += 7

  const valW = infoW - labelW
  const rows = [
    ['상 호', data.company.name, '상 호', data.supplier.name],
    ['대 표 자', `${data.company.ceo ?? ''}          (인)`, '대 표 자', data.supplier.ceo ?? ''],
    ['사업자번호', data.company.bizNo ?? '', '사업자번호', data.supplier.bizNo ?? ''],
    ['주 소', data.company.address ?? '', '주 소', data.supplier.address ?? ''],
    ['전 화', data.company.tel ?? '', '전 화', data.supplier.tel ?? ''],
  ]
  for (const row of rows) {
    cell(PAGE_MARGIN, y, labelW, irh, row[0], { align: 'center', fill: true, fontSize: 7 })
    cell(PAGE_MARGIN + labelW, y, valW, irh, row[1], { fontSize: 7.5 })
    cell(PAGE_MARGIN + infoW + 4, y, labelW, irh, row[2], { align: 'center', fill: true, fontSize: 7 })
    cell(PAGE_MARGIN + infoW + 4 + labelW, y, valW, irh, row[3], { fontSize: 7.5 })
    y += irh
  }
  y += 4

  // --- 합계 ---
  autoTable({
    ...summaryTableStyles,
    startY: y,
    head: [['공급가액', '부가세(VAT)', '합계금액']],
    body: [[fmtNumber(data.totalSupply), fmtNumber(data.totalTax), fmtNumber(data.totalAmount)]],
    columnStyles: { 2: { halign: 'right' as const, fontStyle: 'bold' as const } },
  })
  y = getLastTableY(doc) + 3

  // --- 품목 테이블 ---
  autoTable({
    ...itemTableStyles,
    startY: y,
    head: [['No', '품명', '규격', '단위', '수량', '단가', '공급가액', '세액', '합계']],
    body: data.items.map((item) => [
      String(item.no),
      item.itemName,
      item.spec ?? '',
      item.unit ?? '',
      fmtNumber(item.qty),
      fmtNumber(item.unitPrice),
      fmtNumber(item.supplyAmount),
      fmtNumber(item.taxAmount),
      fmtNumber(item.totalAmount),
    ]),
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 20 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 24, halign: 'right' },
    },
  })
  y = getLastTableY(doc) + 6

  // --- 납품조건 ---
  if (data.deliveryLocation || data.paymentTerms || data.description) {
    autoTable({
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      body: [
        ...(data.deliveryLocation ? [['납품장소', data.deliveryLocation]] : []),
        ...(data.paymentTerms ? [['결제조건', data.paymentTerms]] : []),
        ...(data.description ? [['비    고', data.description]] : []),
      ],
      columnStyles: {
        0: { cellWidth: 28, ...labelColumnStyle },
      },
    })
    y = getLastTableY(doc) + 6
  }

  // --- 특기사항 ---
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('※ 납기일을 반드시 준수하여 주시기 바랍니다.', PAGE_MARGIN, y)
  y += 4
  doc.text('※ 품질규격에 부합하지 않는 제품은 반품 처리됩니다.', PAGE_MARGIN, y)
  doc.setTextColor(0, 0, 0)

  addPageNumbers(doc, fontName, { prefix: `출력일: ${fmtPrintDate()}` })
  doc.save(`발주서_${data.orderNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 5. 전표 (Voucher / Accounting Slip) — 한국 표준 양식
// ---------------------------------------------------------------------------

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  RECEIPT: '입금전표',
  PAYMENT: '출금전표',
  TRANSFER: '대체전표',
  PURCHASE: '매입전표',
  SALES: '매출전표',
}

export async function generateVoucherPDF(data: VoucherPDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()
  const cell = makeCell(doc, fontName, 8)

  const typeLabel = VOUCHER_TYPE_LABELS[data.voucherType] || '전표'
  let y = 12

  // --- 회사명 ---
  doc.setFontSize(9)
  doc.setFont(fontName, 'normal')
  doc.text(data.company.name, PAGE_MARGIN, y)
  y += 4

  // --- 제목 ---
  doc.setFontSize(20)
  doc.text(typeLabel, pageWidth / 2, y + 4, { align: 'center' })
  y += 12

  // --- 메타정보 ---
  const rh = 7
  const metaW = (pageWidth - 2 * PAGE_MARGIN) / 4
  cell(PAGE_MARGIN, y, 20, rh, '전표번호', { align: 'center', fill: true, fontSize: 7 })
  cell(PAGE_MARGIN + 20, y, metaW - 20, rh, data.voucherNo, { fontSize: 8 })
  cell(PAGE_MARGIN + metaW, y, 20, rh, '전표일자', { align: 'center', fill: true, fontSize: 7 })
  cell(PAGE_MARGIN + metaW + 20, y, metaW - 20, rh, data.voucherDate, { fontSize: 8 })
  cell(PAGE_MARGIN + metaW * 2, y, 20, rh, '작 성 자', { align: 'center', fill: true, fontSize: 7 })
  cell(PAGE_MARGIN + metaW * 2 + 20, y, metaW - 20, rh, data.createdBy, { fontSize: 8 })
  cell(PAGE_MARGIN + metaW * 3, y, 20, rh, '승 인 자', { align: 'center', fill: true, fontSize: 7 })
  cell(PAGE_MARGIN + metaW * 3 + 20, y, metaW - 20, rh, data.approvedBy ?? '', { fontSize: 8 })
  y += rh + 2

  // --- 적요 ---
  if (data.description) {
    cell(PAGE_MARGIN, y, 20, rh, '적    요', { align: 'center', fill: true, fontSize: 7 })
    cell(PAGE_MARGIN + 20, y, pageWidth - 2 * PAGE_MARGIN - 20, rh, data.description, { fontSize: 8 })
    y += rh + 2
  }

  // --- 결재란 ---
  const stampW = 22
  const stampH = 20
  const stampLabels = ['담 당', '팀 장', '부문장']
  const stampStartX = pageWidth - PAGE_MARGIN - stampW * stampLabels.length
  for (let i = 0; i < stampLabels.length; i++) {
    const sx = stampStartX + stampW * i
    cell(sx, y, stampW, 6, stampLabels[i], { align: 'center', fill: true, fontSize: 6.5 })
    cell(sx, y + 6, stampW, stampH - 6, '', { align: 'center' })
  }
  y += stampH + 4

  // --- 분개 테이블 ---
  autoTable({
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { ...defaultHeadStyles, fontSize: 8 },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [['No', '계정과목', '계정코드', '적요', '차변금액', '대변금액']],
    body: data.details.map((d) => [
      String(d.lineNo),
      d.accountName,
      d.accountCode,
      d.description || '',
      d.debitAmount ? fmtNumber(d.debitAmount) : '',
      d.creditAmount ? fmtNumber(d.creditAmount) : '',
    ]),
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 50 },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
  })
  y = getLastTableY(doc) + 1

  // --- 합계 ---
  autoTable({
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    body: [['', '합          계', '', '', fmtNumber(data.totalDebit), fmtNumber(data.totalCredit)]],
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 40, halign: 'center', fontStyle: 'bold', fillColor: PDF_COLORS.LIGHT_GRAY },
      2: { cellWidth: 22 },
      3: { cellWidth: 50 },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  })
  y = getLastTableY(doc) + 6

  // --- 차대변 검증 ---
  if (data.totalDebit === data.totalCredit) {
    doc.setFontSize(8)
    doc.setTextColor(0, 128, 0)
    doc.text('※ 차변합계와 대변합계가 일치합니다.', PAGE_MARGIN, y)
    doc.setTextColor(0, 0, 0)
  }

  addPageNumbers(doc, fontName, { prefix: `출력일: ${fmtPrintDate()}` })
  doc.save(`${typeLabel}_${data.voucherNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 6. 수주확인서 (Sales Order Confirmation) — 한국 표준 양식
// ---------------------------------------------------------------------------

export async function generateSalesOrderPDF(data: SalesOrderPDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()
  const cell = makeCell(doc, fontName, 8)

  let y = 12

  // --- 제목 ---
  doc.setFontSize(22)
  doc.setFont(fontName, 'normal')
  doc.text('수 주 확 인 서', pageWidth / 2, y, { align: 'center' })
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text('(Sales Order Confirmation)', pageWidth / 2, y + 2, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 8

  // --- 수신처 ---
  doc.setFontSize(10)
  doc.text(`${data.partner.name}  귀하`, PAGE_MARGIN, y)
  doc.setFontSize(8)
  doc.text(`주문번호: ${data.orderNo}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  y += 5
  doc.text(`주문일자: ${data.orderDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  if (data.deliveryDate) {
    y += 4
    doc.text(`납품예정일: ${data.deliveryDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  }
  y += 6

  // --- 금액 ---
  const amountKo = numberToKorean(Math.floor(data.totalAmount))
  const rh = 8
  cell(PAGE_MARGIN, y, 28, rh, '합 계 금 액', { align: 'center', fill: true, fontSize: 9 })
  cell(PAGE_MARGIN + 28, y, pageWidth - 2 * PAGE_MARGIN - 28, rh,
    `일금  ${amountKo}원정  (₩${fmtNumber(data.totalAmount)})`, { fontSize: 10 })
  y += rh + 2

  doc.setFontSize(9)
  doc.text('아래와 같이 수주를 확인합니다.', PAGE_MARGIN, y + 3)
  y += 8

  // --- 공급자/수신처 정보 ---
  const infoW = (pageWidth - 2 * PAGE_MARGIN - 4) / 2
  const labelW = 24
  const irh = 6.5

  cell(PAGE_MARGIN, y, infoW, 7, '공  급  자', { align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 8 })
  cell(PAGE_MARGIN + infoW + 4, y, infoW, 7, '주  문  자', { align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 8 })
  y += 7

  const valW = infoW - labelW
  const infoRows = [
    ['상 호', data.company.name, '상 호', data.partner.name],
    ['대 표 자', `${data.company.ceo ?? ''}          (인)`, '대 표 자', data.partner.ceo ?? ''],
    ['사업자번호', data.company.bizNo ?? '', '사업자번호', data.partner.bizNo ?? ''],
    ['주 소', data.company.address ?? '', '주 소', data.partner.address ?? ''],
    ['전 화', data.company.tel ?? '', '전 화', data.partner.tel ?? ''],
  ]
  for (const row of infoRows) {
    cell(PAGE_MARGIN, y, labelW, irh, row[0], { align: 'center', fill: true, fontSize: 7 })
    cell(PAGE_MARGIN + labelW, y, valW, irh, row[1], { fontSize: 7.5 })
    cell(PAGE_MARGIN + infoW + 4, y, labelW, irh, row[2], { align: 'center', fill: true, fontSize: 7 })
    cell(PAGE_MARGIN + infoW + 4 + labelW, y, valW, irh, row[3], { fontSize: 7.5 })
    y += irh
  }
  y += 4

  // --- 합계 ---
  autoTable({
    ...summaryTableStyles,
    startY: y,
    head: [['공급가액', '부가세(VAT)', '합계금액']],
    body: [[fmtNumber(data.totalSupply), fmtNumber(data.totalTax), fmtNumber(data.totalAmount)]],
    columnStyles: { 2: { halign: 'right' as const, fontStyle: 'bold' as const } },
  })
  y = getLastTableY(doc) + 3

  // --- 품목 ---
  autoTable({
    ...itemTableStyles,
    startY: y,
    head: [['No', '품명', '규격', '단위', '수량', '단가', '공급가액', '세액', '합계']],
    body: data.items.map((item) => [
      String(item.no),
      item.itemName,
      item.spec ?? '',
      item.unit ?? '',
      fmtNumber(item.qty),
      fmtNumber(item.unitPrice),
      fmtNumber(item.supplyAmount),
      fmtNumber(item.taxAmount),
      fmtNumber(item.totalAmount),
    ]),
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 20 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 24, halign: 'right' },
    },
  })
  y = getLastTableY(doc) + 6

  // --- 추가 정보 ---
  if (data.deliveryAddress || data.paymentTerms || data.description) {
    autoTable({
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      body: [
        ...(data.deliveryAddress ? [['배송주소', data.deliveryAddress]] : []),
        ...(data.paymentTerms ? [['결제조건', data.paymentTerms]] : []),
        ...(data.description ? [['비    고', data.description]] : []),
      ],
      columnStyles: { 0: { cellWidth: 28, ...labelColumnStyle } },
    })
  }

  addPageNumbers(doc, fontName, { prefix: `출력일: ${fmtPrintDate()}` })
  doc.save(`수주확인서_${data.orderNo}.pdf`)
}

// ---------------------------------------------------------------------------
// 7. 급여명세서 (Payroll Slip)
// ---------------------------------------------------------------------------

export interface PayrollSlipPDFData {
  payPeriod: string
  payDate: string
  company: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  employee: {
    name: string
    employeeNo: string
    department?: string
    position?: string
  }
  earnings: {
    baseSalary: number
    overtimePay: number
    bonusPay: number
    mealAllowance: number
    transportAllowance: number
    totalEarnings: number
  }
  deductions: {
    nationalPension: number
    healthInsurance: number
    longTermCare: number
    employmentInsurance: number
    incomeTax: number
    localIncomeTax: number
    totalDeductions: number
  }
  netPay: number
}

export async function generatePayrollSlipPDF(data: PayrollSlipPDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()
  const cell = makeCell(doc, fontName, 8)

  let y = 14

  // --- 제목 ---
  doc.setFontSize(20)
  doc.setFont(fontName, 'normal')
  doc.text('급   여   명   세   서', pageWidth / 2, y, { align: 'center' })
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(`${data.payPeriod} (지급일: ${data.payDate})`, pageWidth / 2, y + 2, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 10

  // --- 사원 정보 ---
  const rh = 7
  const infoW = (pageWidth - 2 * PAGE_MARGIN) / 4
  cell(PAGE_MARGIN, y, infoW, rh, '성    명', { align: 'center', fill: true, fontSize: 8 })
  cell(PAGE_MARGIN + infoW, y, infoW, rh, data.employee.name, { align: 'center', fontSize: 9 })
  cell(PAGE_MARGIN + infoW * 2, y, infoW, rh, '사    번', { align: 'center', fill: true, fontSize: 8 })
  cell(PAGE_MARGIN + infoW * 3, y, infoW, rh, data.employee.employeeNo, { align: 'center', fontSize: 9 })
  y += rh
  cell(PAGE_MARGIN, y, infoW, rh, '부    서', { align: 'center', fill: true, fontSize: 8 })
  cell(PAGE_MARGIN + infoW, y, infoW, rh, data.employee.department || '-', { align: 'center', fontSize: 9 })
  cell(PAGE_MARGIN + infoW * 2, y, infoW, rh, '직    급', { align: 'center', fill: true, fontSize: 8 })
  cell(PAGE_MARGIN + infoW * 3, y, infoW, rh, data.employee.position || '-', { align: 'center', fontSize: 9 })
  y += rh + 6

  // --- 지급 내역 / 공제 내역 ---
  const halfW = (pageWidth - 2 * PAGE_MARGIN - 4) / 2
  const labelW = halfW * 0.5
  const valW = halfW * 0.5

  // 지급 헤더
  cell(PAGE_MARGIN, y, halfW, 7, '지  급  내  역', {
    align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 9,
  })
  // 공제 헤더
  cell(PAGE_MARGIN + halfW + 4, y, halfW, 7, '공  제  내  역', {
    align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 9,
  })
  y += 7

  const earningsRows = [
    ['기 본 급', data.earnings.baseSalary],
    ['시간외수당', data.earnings.overtimePay],
    ['상 여 금', data.earnings.bonusPay],
    ['식    대', data.earnings.mealAllowance],
    ['교 통 비', data.earnings.transportAllowance],
  ] as const

  const deductionsRows = [
    ['국민연금', data.deductions.nationalPension],
    ['건강보험', data.deductions.healthInsurance],
    ['장기요양', data.deductions.longTermCare],
    ['고용보험', data.deductions.employmentInsurance],
    ['소 득 세', data.deductions.incomeTax],
    ['지방소득세', data.deductions.localIncomeTax],
  ] as const

  const maxRows = Math.max(earningsRows.length, deductionsRows.length)
  for (let i = 0; i < maxRows; i++) {
    // Left: earnings
    if (i < earningsRows.length) {
      cell(PAGE_MARGIN, y, labelW, rh, earningsRows[i][0], { align: 'center', fill: true, fontSize: 7.5 })
      cell(PAGE_MARGIN + labelW, y, valW, rh, fmtNumber(earningsRows[i][1]), { align: 'right', fontSize: 8 })
    } else {
      cell(PAGE_MARGIN, y, labelW, rh, '', {})
      cell(PAGE_MARGIN + labelW, y, valW, rh, '', {})
    }
    // Right: deductions
    if (i < deductionsRows.length) {
      cell(PAGE_MARGIN + halfW + 4, y, labelW, rh, deductionsRows[i][0], { align: 'center', fill: true, fontSize: 7.5 })
      cell(PAGE_MARGIN + halfW + 4 + labelW, y, valW, rh, fmtNumber(deductionsRows[i][1]), { align: 'right', fontSize: 8 })
    } else {
      cell(PAGE_MARGIN + halfW + 4, y, labelW, rh, '', {})
      cell(PAGE_MARGIN + halfW + 4 + labelW, y, valW, rh, '', {})
    }
    y += rh
  }

  // 소계
  cell(PAGE_MARGIN, y, labelW, rh, '지급 합계', {
    align: 'center', fill: true, fillColor: [220, 230, 250], fontSize: 8,
  })
  cell(PAGE_MARGIN + labelW, y, valW, rh, fmtNumber(data.earnings.totalEarnings), {
    align: 'right', fontSize: 9,
  })
  cell(PAGE_MARGIN + halfW + 4, y, labelW, rh, '공제 합계', {
    align: 'center', fill: true, fillColor: [250, 220, 220], fontSize: 8,
  })
  cell(PAGE_MARGIN + halfW + 4 + labelW, y, valW, rh, fmtNumber(data.deductions.totalDeductions), {
    align: 'right', fontSize: 9,
  })
  y += rh + 6

  // --- 실수령액 ---
  const netW = pageWidth - 2 * PAGE_MARGIN
  cell(PAGE_MARGIN, y, netW * 0.3, 10, '실 수 령 액', {
    align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 11,
  })
  cell(PAGE_MARGIN + netW * 0.3, y, netW * 0.7, 10, `₩ ${fmtNumber(data.netPay)}`, {
    align: 'right', fontSize: 14,
  })
  y += 16

  // --- 회사 정보 ---
  doc.setFontSize(9)
  doc.text(data.company.name, pageWidth / 2, y, { align: 'center' })
  if (data.company.ceo) {
    y += 5
    doc.setFontSize(8)
    doc.text(`대표이사  ${data.company.ceo}`, pageWidth / 2, y, { align: 'center' })
  }

  addPageNumbers(doc, fontName, { prefix: `출력일: ${fmtPrintDate()}` })
  doc.save(`급여명세서_${data.payPeriod}_${data.employee.name}.pdf`)
}

// ---------------------------------------------------------------------------
// 납품서 (Delivery Note)
// ---------------------------------------------------------------------------

export interface DeliveryNotePDFData {
  deliveryNo: string
  deliveryDate: string
  orderNo?: string
  company: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  buyer: { name: string; ceo?: string; address?: string; tel?: string; bizNo?: string }
  items: {
    no: number
    itemName: string
    spec?: string
    unit?: string
    qty: number
    unitPrice: number
    supplyAmount: number
    taxAmount: number
    totalAmount: number
  }[]
  totalSupply: number
  totalTax: number
  totalAmount: number
  deliveryAddress?: string
  trackingNo?: string
  carrier?: string
  description?: string
}

export async function generateDeliveryNotePDF(data: DeliveryNotePDFData) {
  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument()
  const cell = makeCell(doc, fontName, 8)
  const contentWidth = pageWidth - 2 * PAGE_MARGIN

  let y = 14

  // --- 제목 ---
  doc.setFontSize(18)
  doc.setFont(fontName, 'normal')
  doc.text('납   품   서', pageWidth / 2, y, { align: 'center' })
  y += 8

  // --- 날짜/번호 ---
  doc.setFontSize(9)
  doc.text(`납품일: ${data.deliveryDate}`, pageWidth - PAGE_MARGIN, y, { align: 'right' })
  if (data.deliveryNo) {
    doc.text(`납품번호: ${data.deliveryNo}`, PAGE_MARGIN, y)
  }
  y += 6

  // --- 공급자/공급받는자 정보 ---
  const halfW = (contentWidth - 4) / 2
  const lw = halfW * 0.3
  const vw = halfW * 0.7
  const rh = 7

  // 공급자 헤더
  cell(PAGE_MARGIN, y, halfW, rh, '공  급  자', {
    align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 9,
  })
  cell(PAGE_MARGIN + halfW + 4, y, halfW, rh, '공 급 받 는 자', {
    align: 'center', fill: true, fillColor: PDF_COLORS.HEADER_FILL, textColor: [255, 255, 255], fontSize: 9,
  })
  y += rh

  const supplierRows = [
    ['상    호', data.company.name],
    ['대 표 자', data.company.ceo || '-'],
    ['사업자번호', data.company.bizNo || '-'],
    ['주    소', data.company.address || '-'],
    ['전    화', data.company.tel || '-'],
  ]

  const buyerRows = [
    ['상    호', data.buyer.name],
    ['대 표 자', data.buyer.ceo || '-'],
    ['사업자번호', data.buyer.bizNo || '-'],
    ['주    소', data.buyer.address || '-'],
    ['전    화', data.buyer.tel || '-'],
  ]

  for (let i = 0; i < supplierRows.length; i++) {
    cell(PAGE_MARGIN, y, lw, rh, supplierRows[i][0], { align: 'center', fill: true, fontSize: 7.5 })
    cell(PAGE_MARGIN + lw, y, vw - lw + lw, rh, supplierRows[i][1], { align: 'left', fontSize: 8 })
    cell(PAGE_MARGIN + halfW + 4, y, lw, rh, buyerRows[i][0], { align: 'center', fill: true, fontSize: 7.5 })
    cell(PAGE_MARGIN + halfW + 4 + lw, y, vw - lw + lw, rh, buyerRows[i][1], { align: 'left', fontSize: 8 })
    y += rh
  }
  y += 4

  // --- 금액 한글 표기 ---
  const koreanAmt = numberToKorean(Math.round(data.totalAmount))
  doc.setFontSize(10)
  doc.text(`합계금액:  금  ${koreanAmt}원정 (₩${fmtNumber(Math.round(data.totalAmount))})`, pageWidth / 2, y, { align: 'center' })
  y += 8

  // --- 품목 테이블 ---
  autoTable({
    startY: y,
    head: [['No', '품목명', '규격', '단위', '수량', '단가', '공급가액', '세액', '합계']],
    body: data.items.map((item) => [
      item.no,
      item.itemName,
      item.spec || '',
      item.unit || '',
      item.qty.toLocaleString(),
      fmtNumber(item.unitPrice),
      fmtNumber(item.supplyAmount),
      fmtNumber(item.taxAmount),
      fmtNumber(item.totalAmount),
    ]),
    ...itemTableStyles,
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  })
  y = getLastTableY(doc) + 4

  // --- 합계 ---
  autoTable({
    startY: y,
    head: [['공급가액', '세액', '합계금액']],
    body: [[fmtNumber(data.totalSupply), fmtNumber(data.totalTax), fmtNumber(data.totalAmount)]],
    ...summaryTableStyles,
  })
  y = getLastTableY(doc) + 6

  // --- 배송 정보 ---
  if (data.deliveryAddress || data.trackingNo || data.carrier) {
    doc.setFontSize(9)
    doc.setFont(fontName, 'normal')
    const deliveryInfo: string[] = []
    if (data.deliveryAddress) deliveryInfo.push(`배송지: ${data.deliveryAddress}`)
    if (data.carrier) deliveryInfo.push(`택배사: ${data.carrier}`)
    if (data.trackingNo) deliveryInfo.push(`운송장번호: ${data.trackingNo}`)
    doc.text(deliveryInfo.join('  |  '), PAGE_MARGIN, y)
    y += 6
  }

  if (data.description) {
    doc.setFontSize(8)
    doc.text(`비고: ${data.description}`, PAGE_MARGIN, y)
  }

  addPageNumbers(doc, fontName, { prefix: `출력일: ${fmtPrintDate()}` })
  doc.save(`납품서_${data.deliveryNo}.pdf`)
}

import { createPDFDocument, addPageNumbers, getLastTableY, PDF_COLORS, fmtPrintDate } from './pdf-base'
import { sanitizeFileName } from '@/lib/sanitize'

interface ApprovalDocExport {
  documentNo: string
  title: string
  docType?: string
  draftDate: string
  urgency: string
  status: string
  content:
    | {
        body?: string
        amount?: string
        period?: string
        destination?: string
        purpose?: string
        [key: string]: unknown
      }
    | string
    | null
  drafter: {
    nameKo: string
    department?: { name: string } | null
    position?: { name: string } | null
  }
  steps: {
    stepOrder: number
    approver: {
      nameKo: string
      position?: { name: string } | null
      department?: { name: string } | null
    }
    status: string
    comment?: string | null
    actionDate?: string | null
  }[]
}

const STATUS_MAP: Record<string, string> = {
  DRAFTED: '임시저장',
  IN_PROGRESS: '진행중',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
  PENDING: '대기',
}

const URGENCY_MAP: Record<string, string> = {
  NORMAL: '일반',
  URGENT: '긴급',
  EMERGENCY: '초긴급',
}

const DOC_TYPE_MAP: Record<string, string> = {
  GENERAL: '일 반 기 안',
  EXPENDITURE: '지 출 결 의 서',
  BUSINESS_TRIP: '출 장 신 청 서',
  OVERTIME: '시간외근무신청서',
  PURCHASE: '구 매 요 청 서',
  REPORT: '업 무 보 고 서',
  COOPERATION: '업 무 협 조 전',
}

export async function exportApprovalPdf(doc: ApprovalDocExport) {
  const { doc: pdf, autoTable, fontName, pageWidth } = await createPDFDocument()

  const M = 15
  const W = pageWidth - 2 * M
  let y = 12

  // --- 제목 (문서 유형) ---
  const docTypeLabel = DOC_TYPE_MAP[doc.docType ?? 'GENERAL'] || '기  안  서'
  pdf.setFontSize(22)
  pdf.setFont(fontName, 'normal')
  pdf.text(docTypeLabel, pageWidth / 2, y, { align: 'center' })
  y += 10

  // --- 결재란 (우측 상단) ---
  const stampW = 22
  const stampHeaderH = 7
  const stampBodyH = 18
  const steps =
    doc.steps.length > 0
      ? doc.steps
      : [
          {
            stepOrder: 1,
            approver: { nameKo: '', position: null, department: null },
            status: 'PENDING',
            comment: null,
            actionDate: null,
          },
        ]
  const stampLabels = ['기 안', ...steps.map((s) => s.approver.position?.name || `결재${s.stepOrder}`)]
  const stampTotalW = stampW * stampLabels.length
  const stampStartX = pageWidth - M - stampTotalW

  // 기안자 + 결재자 결재란
  for (let i = 0; i < stampLabels.length; i++) {
    const sx = stampStartX + stampW * i

    // 직급 라벨
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.3)
    pdf.setFillColor(240, 240, 240)
    pdf.rect(sx, y, stampW, stampHeaderH, 'FD')
    pdf.setFontSize(7)
    pdf.setFont(fontName, 'normal')
    pdf.text(stampLabels[i], sx + stampW / 2, y + stampHeaderH / 2 + 1, { align: 'center' })

    // 도장 영역
    pdf.rect(sx, y + stampHeaderH, stampW, stampBodyH)
    if (i === 0) {
      // 기안자
      pdf.setFontSize(8)
      pdf.text(doc.drafter.nameKo, sx + stampW / 2, y + stampHeaderH + stampBodyH / 2, { align: 'center' })
    } else {
      const step = steps[i - 1]
      if (step) {
        const statusText = STATUS_MAP[step.status] || step.status
        if (step.status === 'APPROVED') {
          pdf.setTextColor(0, 100, 200)
        } else if (step.status === 'REJECTED') {
          pdf.setTextColor(200, 0, 0)
        }
        pdf.setFontSize(8)
        pdf.text(step.approver.nameKo, sx + stampW / 2, y + stampHeaderH + 7, { align: 'center' })
        pdf.setFontSize(6)
        pdf.text(statusText, sx + stampW / 2, y + stampHeaderH + 12, { align: 'center' })
        if (step.actionDate) {
          pdf.setFontSize(5)
          pdf.text(new Date(step.actionDate).toLocaleDateString('ko-KR'), sx + stampW / 2, y + stampHeaderH + 15.5, {
            align: 'center',
          })
        }
        pdf.setTextColor(0, 0, 0)
      }
    }
  }

  // --- 문서 정보 (좌측) ---
  const infoTableW = stampStartX - M - 8
  if (infoTableW > 60) {
    const labelW = 22
    const valW = infoTableW - labelW
    const irh = 7

    const drawInfoRow = (ry: number, label: string, value: string) => {
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.2)
      pdf.setFillColor(240, 240, 240)
      pdf.rect(M, ry, labelW, irh, 'FD')
      pdf.rect(M + labelW, ry, valW, irh)
      pdf.setFontSize(7)
      pdf.setFont(fontName, 'normal')
      pdf.text(label, M + labelW / 2, ry + irh / 2 + 1, { align: 'center' })
      pdf.setFontSize(8)
      pdf.text(value, M + labelW + 2, ry + irh / 2 + 1)
    }

    drawInfoRow(y, '문서번호', doc.documentNo)
    drawInfoRow(y + irh, '기 안 일', doc.draftDate)
    drawInfoRow(y + irh * 2, '기 안 자', `${doc.drafter.nameKo} / ${doc.drafter.department?.name || '-'}`)
    drawInfoRow(y + irh * 3, '긴 급 도', URGENCY_MAP[doc.urgency] || doc.urgency)
  }

  y += stampHeaderH + stampBodyH + 8

  // --- 구분선 ---
  pdf.setLineWidth(0.5)
  pdf.setDrawColor(0, 0, 0)
  pdf.line(M, y, pageWidth - M, y)
  y += 6

  // --- 제목 ---
  autoTable({
    startY: y,
    body: [['제    목', doc.title]],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28, fillColor: [240, 240, 240], halign: 'center' },
      1: { cellWidth: 'auto' as unknown as number },
    },
    margin: { left: M, right: M },
  })
  y = getLastTableY(pdf) + 6

  // --- 본문 내용 ---
  const content = typeof doc.content === 'object' && doc.content !== null ? doc.content : null

  // 지출결의서 전용 상세정보
  if (doc.docType === 'EXPENDITURE' && content) {
    const expendRows: string[][] = []
    if (content.purpose) expendRows.push(['지출목적', String(content.purpose)])
    if (content.amount) expendRows.push(['지출금액', String(content.amount)])
    if (content.period) expendRows.push(['기    간', String(content.period)])

    if (expendRows.length > 0) {
      autoTable({
        startY: y,
        body: expendRows,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 28, fillColor: [240, 240, 240], halign: 'center' },
          1: { cellWidth: 'auto' as unknown as number },
        },
        margin: { left: M, right: M },
      })
      y = getLastTableY(pdf) + 4
    }
  }

  // 출장신청서 전용 상세정보
  if (doc.docType === 'BUSINESS_TRIP' && content) {
    const tripRows: string[][] = []
    if (content.destination) tripRows.push(['출장지', String(content.destination)])
    if (content.period) tripRows.push(['기    간', String(content.period)])
    if (content.purpose) tripRows.push(['목    적', String(content.purpose)])
    if (content.amount) tripRows.push(['예상경비', String(content.amount)])

    if (tripRows.length > 0) {
      autoTable({
        startY: y,
        body: tripRows,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 28, fillColor: [240, 240, 240], halign: 'center' },
          1: { cellWidth: 'auto' as unknown as number },
        },
        margin: { left: M, right: M },
      })
      y = getLastTableY(pdf) + 4
    }
  }

  // 구매요청서 전용 상세정보
  if (doc.docType === 'PURCHASE' && content) {
    const purchRows: string[][] = []
    if (content.purpose) purchRows.push(['구매목적', String(content.purpose)])
    if (content.amount) purchRows.push(['예상금액', String(content.amount)])
    if (content.period) purchRows.push(['필요시기', String(content.period)])

    if (purchRows.length > 0) {
      autoTable({
        startY: y,
        body: purchRows,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 28, fillColor: [240, 240, 240], halign: 'center' },
          1: { cellWidth: 'auto' as unknown as number },
        },
        margin: { left: M, right: M },
      })
      y = getLastTableY(pdf) + 4
    }
  }

  // 본문
  if (content?.body) {
    // 내용 라벨
    pdf.setDrawColor(0, 0, 0)
    pdf.setLineWidth(0.2)
    pdf.setFillColor(240, 240, 240)
    pdf.rect(M, y, 28, 7, 'FD')
    pdf.setFontSize(7)
    pdf.text('내    용', M + 14, y + 4.5, { align: 'center' })
    y += 10

    pdf.setFontSize(10)
    const lines = pdf.splitTextToSize(content.body, W - 10)
    pdf.text(lines, M + 5, y)
    y += lines.length * 5 + 4
  }

  // 추가 정보
  if (content && !content.body) {
    const extraRows: string[][] = []
    if (
      content.amount &&
      doc.docType !== 'EXPENDITURE' &&
      doc.docType !== 'BUSINESS_TRIP' &&
      doc.docType !== 'PURCHASE'
    ) {
      extraRows.push(['금    액', String(content.amount)])
    }
    if (
      content.period &&
      doc.docType !== 'EXPENDITURE' &&
      doc.docType !== 'BUSINESS_TRIP' &&
      doc.docType !== 'PURCHASE'
    ) {
      extraRows.push(['기    간', String(content.period)])
    }
    if (content.destination && doc.docType !== 'BUSINESS_TRIP') {
      extraRows.push(['목 적 지', String(content.destination)])
    }
    if (
      content.purpose &&
      doc.docType !== 'EXPENDITURE' &&
      doc.docType !== 'BUSINESS_TRIP' &&
      doc.docType !== 'PURCHASE'
    ) {
      extraRows.push(['목    적', String(content.purpose)])
    }

    if (extraRows.length > 0) {
      autoTable({
        startY: y,
        body: extraRows,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 28, fillColor: [240, 240, 240], halign: 'center' },
        },
        margin: { left: M, right: M },
      })
      y = getLastTableY(pdf) + 6
    }
  }

  // --- 결재 이력 ---
  if (doc.steps.length > 0) {
    y += 4
    pdf.setFontSize(10)
    pdf.setFont(fontName, 'normal')
    pdf.text('결재 이력', M, y)
    y += 4

    autoTable({
      startY: y,
      head: [['순번', '결재자', '직급', '부서', '상태', '의견', '처리일']],
      body: doc.steps.map((s) => [
        String(s.stepOrder),
        s.approver.nameKo,
        s.approver.position?.name || '-',
        s.approver.department?.name || '-',
        STATUS_MAP[s.status] || s.status,
        s.comment || '-',
        s.actionDate ? new Date(s.actionDate).toLocaleDateString('ko-KR') : '-',
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: PDF_COLORS.HEADER_FILL, textColor: 255, halign: 'center', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        4: { halign: 'center' },
        6: { halign: 'center' },
      },
      margin: { left: M, right: M },
    })
  }

  // 푸터
  addPageNumbers(pdf, fontName, { prefix: `출력일: ${fmtPrintDate()}`, bottomOffset: 10 })

  pdf.save(sanitizeFileName(`${doc.documentNo}_${doc.title}`) + '.pdf')
}

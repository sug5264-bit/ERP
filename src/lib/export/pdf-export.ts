import type { ExportConfig } from './types'
import { getValue } from './utils'
import { createPDFDocument, addPageNumbers, PDF_COLORS, defaultHeadStyles, fmtPrintDate } from './pdf-base'
import { sanitizeFileName } from '@/lib/sanitize'

export async function exportToPDF(config: ExportConfig) {
  const { fileName, title, columns, data } = config

  const { doc, autoTable, fontName, pageWidth } = await createPDFDocument({
    orientation: data.length > 0 && columns.length > 6 ? 'landscape' : 'portrait',
  })

  // 제목
  if (title) {
    doc.setFontSize(16)
    doc.text(title, pageWidth / 2, 15, { align: 'center' })
  }

  // 출력일
  doc.setFontSize(9)
  doc.text(`출력일: ${fmtPrintDate()}`, pageWidth - 14, title ? 22 : 10, { align: 'right' })

  // 테이블
  const head = [columns.map((c) => c.header)]
  const body = data.map((row) =>
    columns.map((col) => {
      const val = getValue(row, col.accessor)
      return val != null ? String(val) : ''
    })
  )

  autoTable({
    head,
    body,
    startY: title ? 26 : 14,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: defaultHeadStyles,
    alternateRowStyles: {
      fillColor: PDF_COLORS.ALT_ROW,
    },
    margin: { left: 10, right: 10 },
  })

  // 페이지 번호
  addPageNumbers(doc, fontName)

  doc.save(sanitizeFileName(fileName) + '.pdf')
}

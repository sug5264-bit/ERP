import type { ExportConfig } from './types'

function getValue(row: any, accessor: string | ((row: any) => any)): string {
  let val: any
  if (typeof accessor === 'function') val = accessor(row)
  else val = accessor.split('.').reduce((obj, key) => obj?.[key], row)
  return val != null ? String(val) : ''
}

// 폰트 캐시 (메모리)
let cachedFontBase64: string | null = null

async function loadKoreanFontForExport(doc: InstanceType<typeof import('jspdf').default>): Promise<string> {
  if (cachedFontBase64) {
    doc.addFileToVFS('korean.ttf', cachedFontBase64)
    doc.addFont('korean.ttf', 'korean', 'normal')
    doc.setFont('korean')
    return 'korean'
  }

  const fontUrls = [
    '/fonts/ipag.ttf',
    'https://cdn.jsdelivr.net/gh/psjdev/jsPDF-Korean-Fonts-Support@main/fonts/malgun.ttf',
    'https://fastly.jsdelivr.net/gh/psjdev/jsPDF-Korean-Fonts-Support@main/fonts/malgun.ttf',
  ]

  for (const fontUrl of fontUrls) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const response = await fetch(fontUrl, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        const chunkSize = 8192
        let binary = ''
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
          binary += String.fromCharCode.apply(null, Array.from(chunk))
        }
        const base64 = btoa(binary)
        cachedFontBase64 = base64
        doc.addFileToVFS('korean.ttf', base64)
        doc.addFont('korean.ttf', 'korean', 'normal')
        doc.setFont('korean')
        return 'korean'
      }
    } catch {
      continue
    }
  }

  return 'helvetica'
}

export async function exportToPDF(config: ExportConfig) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const { fileName, title, columns, data } = config

  const doc = new jsPDF({
    orientation: data.length > 0 && columns.length > 6 ? 'landscape' : 'portrait',
    putOnlyUsedFonts: true,
  })

  const fontName = await loadKoreanFontForExport(doc)

  // 제목
  if (title) {
    doc.setFontSize(16)
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' })
  }

  // 날짜
  doc.setFontSize(9)
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  doc.text(`출력일: ${dateStr}`, doc.internal.pageSize.getWidth() - 14, title ? 22 : 10, { align: 'right' })

  // 테이블
  const head = [columns.map((c) => c.header)]
  const body = data.map((row) => columns.map((col) => getValue(row, col.accessor)))

  autoTable(doc, {
    head,
    body,
    startY: title ? 26 : 14,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: fontName,
    },
    headStyles: {
      fillColor: [68, 114, 196],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 10, right: 10 },
  })

  // 페이지 번호
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    if (fontName !== 'helvetica') doc.setFont(fontName)
    doc.text(
      `${i} / ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    )
  }

  doc.save(`${fileName}.pdf`)
}

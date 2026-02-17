export async function readExcelFile(file: File, keyMap: Record<string, string>): Promise<any[]> {
  const { default: ExcelJS } = await import('exceljs')

  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) return []

  // 헤더 읽기 (1행)
  const headers: string[] = []
  sheet.getRow(1).eachCell((cell, colNum) => {
    headers[colNum - 1] = String(cell.value || '').replace(/\*/g, '').trim()
  })

  // 헤더 → key 매핑
  const colKeys: (string | null)[] = headers.map((h) => keyMap[h] || null)

  // 데이터 읽기 (2행부터)
  const rows: any[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const obj: any = {}
    let hasValue = false

    colKeys.forEach((key, i) => {
      if (!key) return
      const cell = row.getCell(i + 1)
      let val = cell.value
      // ExcelJS richtext 처리
      if (val && typeof val === 'object' && 'richText' in val) {
        val = (val as any).richText.map((rt: any) => rt.text).join('')
      }
      // 날짜 객체는 ISO 문자열로
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0]
      }
      if (val != null && val !== '') {
        obj[key] = val
        hasValue = true
      }
    })

    if (hasValue) rows.push(obj)
  }

  return rows
}

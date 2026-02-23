const MAX_EXCEL_SIZE_MB = 10

export async function readExcelFile(file: File, keyMap: Record<string, string>): Promise<any[]> {
  if (file.size > MAX_EXCEL_SIZE_MB * 1024 * 1024) {
    throw new Error(`파일 크기가 ${MAX_EXCEL_SIZE_MB}MB를 초과합니다.`)
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'xlsx' && ext !== 'xls') {
    throw new Error('지원하지 않는 파일 형식입니다. .xlsx 또는 .xls 파일만 업로드 가능합니다.')
  }

  const { default: ExcelJS } = await import('exceljs')

  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()

  try {
    await workbook.xlsx.load(buffer)
  } catch {
    throw new Error('엑셀 파일을 읽을 수 없습니다. 올바른 .xlsx 파일인지 확인해주세요.')
  }

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) return []

  // 헤더 읽기 (1행)
  const headers: string[] = []
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNum) => {
    let headerVal = ''
    const cv = cell.value
    if (cv && typeof cv === 'object' && 'richText' in cv) {
      headerVal = (cv as any).richText.map((rt: any) => rt.text).join('')
    } else {
      headerVal = String(cv || '')
    }
    headers[colNum - 1] = headerVal.replace(/\*/g, '').trim()
  })

  // 헤더 → key 매핑
  const colKeys: (string | null)[] = headers.map((h) => keyMap[h] || null)

  // 매핑된 키가 하나도 없으면 에러
  const validKeys = colKeys.filter(Boolean)
  if (validKeys.length === 0) {
    throw new Error('헤더가 일치하지 않습니다. 템플릿 파일을 다운로드하여 사용해주세요.')
  }

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
      // ExcelJS formula 처리
      if (val && typeof val === 'object' && 'result' in val) {
        val = (val as any).result
      }
      // ExcelJS hyperlink 처리
      if (val && typeof val === 'object' && 'text' in val) {
        val = (val as any).text
      }
      // 날짜 객체는 ISO 문자열로
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0]
      }
      // 숫자인 경우 문자열로 변환하지 않음 (그대로 유지)
      if (val != null && val !== '') {
        obj[key] = val
        hasValue = true
      }
    })

    if (hasValue) rows.push(obj)
  }

  return rows
}

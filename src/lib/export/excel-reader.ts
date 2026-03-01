const MAX_EXCEL_SIZE_MB = 10

/**
 * 헤더 문자열을 정규화합니다.
 * - 앞뒤 공백, *표시, 불필요한 공백 제거
 * - NBSP(U+00A0) 등 특수 공백도 일반 공백으로 치환
 */
function normalizeHeader(raw: string): string {
  return raw
    .replace(/[\u00A0\u3000]/g, ' ') // NBSP, 전각공백 → 일반 공백
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** ExcelJS richText 배열에서 텍스트 추출 */
function extractRichText(val: unknown): string {
  const rich = val as { richText?: { text: string }[] }
  return rich.richText?.map((rt) => rt.text).join('') ?? ''
}

export async function readExcelFile(file: File, keyMap: Record<string, string>): Promise<Record<string, unknown>[]> {
  if (file.size > MAX_EXCEL_SIZE_MB * 1024 * 1024) {
    throw new Error(`파일 크기가 ${MAX_EXCEL_SIZE_MB}MB를 초과합니다.`)
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'xlsx') {
    throw new Error('지원하지 않는 파일 형식입니다. .xlsx 파일만 업로드 가능합니다.')
  }

  const { default: ExcelJS } = await import('exceljs')

  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()

  try {
    await workbook.xlsx.load(buffer)
  } catch (err) {
    const detail = err instanceof Error ? ` (${err.message})` : ''
    throw new Error(`엑셀 파일을 읽을 수 없습니다. 올바른 .xlsx 파일인지 확인해주세요.${detail}`)
  }

  // 첫 번째 시트 (안내사항 시트 제외)
  if (workbook.worksheets.length === 0) return []
  const sheet = workbook.worksheets.find((ws) => ws.name !== '안내사항') || workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) return []

  // 헤더 읽기 (1행)
  const headers: string[] = []
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNum) => {
    let headerVal = ''
    const cv = cell.value
    if (cv && typeof cv === 'object' && 'richText' in cv) {
      headerVal = extractRichText(cv)
    } else {
      headerVal = String(cv || '')
    }
    headers[colNum - 1] = normalizeHeader(headerVal)
  })

  // 헤더 → key 매핑 (정규화된 keyMap으로 매칭)
  const normalizedKeyMap = new Map<string, string>()
  for (const [k, v] of Object.entries(keyMap)) {
    normalizedKeyMap.set(normalizeHeader(k), v)
  }

  const colKeys: (string | null)[] = headers.map((h) => normalizedKeyMap.get(h) || null)

  // 매핑된 키가 하나도 없으면 에러 (기대하는 헤더 목록 안내)
  const validKeys = colKeys.filter(Boolean)
  if (validKeys.length === 0) {
    const expected = Object.keys(keyMap).join(', ')
    throw new Error(`헤더가 일치하지 않습니다. 기대하는 헤더: [${expected}]. 템플릿 파일을 다운로드하여 사용해주세요.`)
  }

  // 데이터 읽기 (2행부터)
  const rows: Record<string, unknown>[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const obj: Record<string, unknown> = {}
    let hasValue = false

    colKeys.forEach((key, i) => {
      if (!key) return
      const cell = row.getCell(i + 1)
      let val: unknown = cell.value
      // ExcelJS richtext 처리
      if (val && typeof val === 'object' && 'richText' in val) {
        val = extractRichText(val)
      }
      // ExcelJS formula 처리
      if (val && typeof val === 'object' && 'result' in val) {
        const formula = val as { result?: unknown; formula?: string }
        val = formula.result ?? formula.formula ?? ''
      }
      // ExcelJS hyperlink 처리
      if (val && typeof val === 'object' && 'text' in val) {
        val = (val as { text: string }).text
      }
      // 날짜 객체는 로컬 날짜 문자열로 (UTC 변환 시 KST -1일 오차 방지)
      if (val instanceof Date) {
        const y = val.getFullYear()
        const m = String(val.getMonth() + 1).padStart(2, '0')
        const d = String(val.getDate()).padStart(2, '0')
        val = `${y}-${m}-${d}`
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

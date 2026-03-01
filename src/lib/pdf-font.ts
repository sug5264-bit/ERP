import type jsPDF from 'jspdf'

let cachedFontBase64: string | null = null

const FONT_NAME = 'Pretendard'
const FONT_FILE = 'Pretendard.ttf'

/**
 * 한글 폰트를 jsPDF 인스턴스에 로드합니다.
 * 로컬 Pretendard → CDN malgun.ttf 순서로 시도하며, 메모리에 캐시합니다.
 */
export async function loadKoreanFont(doc: InstanceType<typeof jsPDF>): Promise<string> {
  if (cachedFontBase64) {
    doc.addFileToVFS(FONT_FILE, cachedFontBase64)
    doc.addFont(FONT_FILE, FONT_NAME, 'normal')
    doc.addFont(FONT_FILE, FONT_NAME, 'bold')
    doc.setFont(FONT_NAME)
    return FONT_NAME
  }

  const fontUrls = [
    '/fonts/PretendardVariable.ttf',
    '/fonts/ipag.ttf',
    'https://cdn.jsdelivr.net/gh/psjdev/jsPDF-Korean-Fonts-Support@main/fonts/malgun.ttf',
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
        const chunks: string[] = []
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
          chunks.push(String.fromCharCode.apply(null, Array.from(chunk)))
        }
        const binary = chunks.join('')
        const base64 = btoa(binary)
        cachedFontBase64 = base64
        doc.addFileToVFS(FONT_FILE, base64)
        doc.addFont(FONT_FILE, FONT_NAME, 'normal')
        doc.addFont(FONT_FILE, FONT_NAME, 'bold')
        doc.setFont(FONT_NAME)
        return FONT_NAME
      }
    } catch {
      continue
    }
  }

  return 'helvetica'
}

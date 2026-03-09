import type jsPDF from 'jspdf'

let cachedFontPromise: Promise<string | null> | null = null

const FONT_NAME = 'Pretendard'
const FONT_FILE = 'Pretendard.ttf'

function applyFont(doc: InstanceType<typeof jsPDF>, base64: string): string {
  doc.addFileToVFS(FONT_FILE, base64)
  doc.addFont(FONT_FILE, FONT_NAME, 'normal')
  doc.addFont(FONT_FILE, FONT_NAME, 'bold')
  doc.setFont(FONT_NAME)
  return FONT_NAME
}

async function fetchFontBase64(): Promise<string | null> {
  const fontUrls = [
    '/fonts/PretendardVariable.ttf',
    '/fonts/ipag.ttf',
    'https://cdn.jsdelivr.net/gh/psjdev/jsPDF-Korean-Fonts-Support@main/fonts/malgun.ttf',
  ]

  for (const fontUrl of fontUrls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(fontUrl, { signal: controller.signal })
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        if (!arrayBuffer || arrayBuffer.byteLength === 0) continue
        const bytes = new Uint8Array(arrayBuffer)
        const chunkSize = 4096
        const chunks: string[] = []
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
          chunks.push(String.fromCharCode(...chunk))
        }
        return btoa(chunks.join(''))
      }
    } catch {
      continue
    } finally {
      clearTimeout(timeoutId)
    }
  }
  return null
}

/**
 * 한글 폰트를 jsPDF 인스턴스에 로드합니다.
 * 로컬 Pretendard → CDN malgun.ttf 순서로 시도하며, 메모리에 캐시합니다.
 * 동시 요청 시 중복 fetch를 방지합니다.
 */
export async function loadKoreanFont(doc: InstanceType<typeof jsPDF>): Promise<string> {
  if (!cachedFontPromise) {
    cachedFontPromise = fetchFontBase64()
  }

  const base64 = await cachedFontPromise
  if (base64) {
    return applyFont(doc, base64)
  }

  // 실패 시 다음 호출에서 재시도할 수 있도록 캐시 초기화
  cachedFontPromise = null
  console.warn('[PDF] 한글 폰트 로드 실패 — PDF에 한글이 정상 출력되지 않을 수 있습니다.')
  return 'helvetica'
}

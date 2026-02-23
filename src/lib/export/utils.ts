/**
 * Export 모듈 공통 유틸리티
 * - getValue: 행 데이터에서 accessor 기반 값 추출
 * - triggerDownload: Blob 기반 브라우저 파일 다운로드
 */

/** 행 데이터에서 accessor(문자열 경로 또는 함수)를 사용해 값 추출 */
export function getValue(row: any, accessor: string | ((row: any) => any)): any {
  if (typeof accessor === 'function') return accessor(row)
  return accessor.split('.').reduce((obj, key) => obj?.[key], row) ?? ''
}

/** Blob을 브라우저 파일 다운로드로 트리거 */
export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

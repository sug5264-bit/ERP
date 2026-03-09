import { describe, it, expect } from 'vitest'

/**
 * 매직 바이트 검증 로직 (admin/company/[id]/upload/route.ts에서 사용)
 */
const MAGIC_BYTES: [string, number[]][] = [
  ['png', [0x89, 0x50, 0x4e, 0x47]],
  ['jpg', [0xff, 0xd8, 0xff]],
  ['jpeg', [0xff, 0xd8, 0xff]],
  ['gif', [0x47, 0x49, 0x46]],
  ['webp', [0x52, 0x49, 0x46, 0x46]],
  ['pdf', [0x25, 0x50, 0x44, 0x46]],
]

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const entry = MAGIC_BYTES.find(([e]) => e === ext)
  if (!entry) return true
  const [, bytes] = entry
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[i] !== bytes[i]) return false
  }
  return true
}

describe('파일 업로드 매직 바이트 검증', () => {
  // === 정상 파일 ===
  describe('정상 파일 매직 바이트', () => {
    it('PNG 파일 (0x89504E47)', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(validateMagicBytes(buf, 'png')).toBe(true)
    })

    it('JPEG 파일 (0xFFD8FF)', () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
      expect(validateMagicBytes(buf, 'jpg')).toBe(true)
      expect(validateMagicBytes(buf, 'jpeg')).toBe(true)
    })

    it('GIF 파일 (GIF87a)', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
      expect(validateMagicBytes(buf, 'gif')).toBe(true)
    })

    it('GIF 파일 (GIF89a)', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      expect(validateMagicBytes(buf, 'gif')).toBe(true)
    })

    it('PDF 파일 (%PDF)', () => {
      const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e])
      expect(validateMagicBytes(buf, 'pdf')).toBe(true)
    })

    it('WebP 파일 (RIFF)', () => {
      const buf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00])
      expect(validateMagicBytes(buf, 'webp')).toBe(true)
    })
  })

  // === 위조 파일 탐지 ===
  describe('확장자 위조 탐지', () => {
    it('.png 확장자지만 실제 JPEG → 거부', () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      expect(validateMagicBytes(jpegBuf, 'png')).toBe(false)
    })

    it('.jpg 확장자지만 실제 PNG → 거부', () => {
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47])
      expect(validateMagicBytes(pngBuf, 'jpg')).toBe(false)
    })

    it('.pdf 확장자지만 실제 실행파일(EXE) → 거부', () => {
      const exeBuf = Buffer.from([0x4d, 0x5a, 0x90, 0x00]) // MZ header
      expect(validateMagicBytes(exeBuf, 'pdf')).toBe(false)
    })

    it('.png 확장자지만 실제 HTML → 거부', () => {
      const htmlBuf = Buffer.from('<html><body>', 'utf-8')
      expect(validateMagicBytes(htmlBuf, 'png')).toBe(false)
    })

    it('.gif 확장자지만 빈 파일 → 거부', () => {
      const emptyBuf = Buffer.from([0x00, 0x00, 0x00])
      expect(validateMagicBytes(emptyBuf, 'gif')).toBe(false)
    })

    it('.jpg 확장자지만 PHP 코드 → 거부', () => {
      const phpBuf = Buffer.from('<?php echo "hack"; ?>', 'utf-8')
      expect(validateMagicBytes(phpBuf, 'jpg')).toBe(false)
    })
  })

  // === 매핑 없는 확장자 ===
  describe('매직 바이트 정의 없는 확장자', () => {
    it('미정의 확장자는 통과 (별도 validation에서 처리)', () => {
      const buf = Buffer.from([0x00, 0x01, 0x02])
      expect(validateMagicBytes(buf, 'txt')).toBe(true)
      expect(validateMagicBytes(buf, 'docx')).toBe(true)
    })
  })

  // === 엣지 케이스 ===
  describe('엣지 케이스', () => {
    it('버퍼가 매직 바이트보다 짧은 경우', () => {
      const shortBuf = Buffer.from([0x89, 0x50]) // PNG는 4바이트 필요
      expect(validateMagicBytes(shortBuf, 'png')).toBe(false)
    })

    it('빈 버퍼', () => {
      const emptyBuf = Buffer.from([])
      expect(validateMagicBytes(emptyBuf, 'png')).toBe(false)
    })
  })
})

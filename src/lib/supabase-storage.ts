import { createClient, SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_BUCKET = 'upload'
export const SHIPPER_BUCKET = 'upload2'

// 허용된 MIME 타입
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'text/csv',
  'text/plain',
  'application/zip',
])

// 최대 파일 크기: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

let _supabase: SupabaseClient | null = null
const _ensuredBuckets = new Set<string>()

function getClient(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SECRET_KEY 환경변수가 필요합니다.')
    }
    _supabase = createClient(url, key)
  }
  return _supabase
}

async function ensureBucket(bucket: string) {
  if (_ensuredBuckets.has(bucket)) return
  const client = getClient()
  const { data } = await client.storage.getBucket(bucket)
  if (!data) {
    await client.storage.createBucket(bucket, { public: false })
  }
  _ensuredBuckets.add(bucket)
}

/**
 * 파일 업로드 (MIME 타입 및 크기 검증 포함)
 */
export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string,
  bucket: string = DEFAULT_BUCKET
): Promise<string> {
  // 파일 크기 검증
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`파일 크기가 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과합니다.`)
  }
  if (buffer.length === 0) {
    throw new Error('빈 파일은 업로드할 수 없습니다.')
  }

  // MIME 타입 검증
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new Error(`허용되지 않는 파일 형식입니다: ${contentType}`)
  }

  // 파일 경로에서 디렉토리 트래버설 방지
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('잘못된 파일 경로입니다.')
  }

  await ensureBucket(bucket)

  const { error } = await getClient().storage.from(bucket).upload(path, buffer, { contentType, upsert: false })

  if (error) throw error

  const { data } = getClient().storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function downloadFile(path: string, bucket: string = DEFAULT_BUCKET): Promise<Buffer> {
  const { data, error } = await getClient().storage.from(bucket).download(path)
  if (error) throw error
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function deleteFile(path: string, bucket: string = DEFAULT_BUCKET): Promise<void> {
  const { error } = await getClient().storage.from(bucket).remove([path])
  if (error) throw error
}

export function getPublicUrl(path: string, bucket: string = DEFAULT_BUCKET): string {
  const { data } = getClient().storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

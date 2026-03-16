import { createClient, SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_BUCKET = 'upload'
export const SHIPPER_BUCKET = 'shipper-upload'

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

export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string,
  bucket: string = DEFAULT_BUCKET
): Promise<string> {
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

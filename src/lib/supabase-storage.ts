import { createClient, SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'uploads'

let _supabase: SupabaseClient | null = null

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

export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await getClient().storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false })

  if (error) throw error

  const { data } = getClient().storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await getClient().storage.from(BUCKET).download(path)
  if (error) throw error
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).remove([path])
  if (error) throw error
}

export function getPublicUrl(path: string): string {
  const { data } = getClient().storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

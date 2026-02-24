/**
 * Next.js Instrumentation
 * 서버 시작 시 한 번 실행되어 DB 스키마 동기화를 확인합니다.
 */
export async function register() {
  // 서버사이드에서만 실행 (Edge 런타임 제외)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      // sales_orders 테이블의 핵심 컬럼 존재 여부를 빠르게 확인
      const missingColumns = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`
        SELECT COUNT(*) as cnt FROM information_schema.columns
        WHERE table_name = 'sales_orders'
          AND column_name IN ('vatIncluded', 'siteName', 'ordererName', 'recipientName', 'dispatchInfo')
      `)

      const count = Number(missingColumns[0]?.cnt ?? 0)

      if (count < 5) {
        console.warn('[instrumentation] Missing columns detected. Running schema sync...')

        // 누락된 컬럼만 추가 (IF NOT EXISTS 패턴)
        const columns: [string, string][] = [
          ['vatIncluded', 'BOOLEAN NOT NULL DEFAULT true'],
          ['dispatchInfo', 'TEXT'],
          ['receivedBy', 'TEXT'],
          ['siteName', 'TEXT'],
          ['ordererName', 'TEXT'],
          ['recipientName', 'TEXT'],
          ['ordererContact', 'TEXT'],
          ['recipientContact', 'TEXT'],
          ['recipientZipCode', 'TEXT'],
          ['recipientAddress', 'TEXT'],
          ['requirements', 'TEXT'],
          ['senderName', 'TEXT'],
          ['senderPhone', 'TEXT'],
          ['senderAddress', 'TEXT'],
          ['shippingCost', 'DECIMAL(15,2)'],
          ['trackingNo', 'TEXT'],
          ['specialNote', 'TEXT'],
        ]

        for (const [col, def] of columns) {
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "${col}" ${def}`)
          } catch {
            // column already exists or other non-critical error
          }
        }

        // partnerId nullable 처리
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "sales_orders" ALTER COLUMN "partnerId" DROP NOT NULL`)
        } catch {
          // already nullable
        }

        console.log('[instrumentation] Schema sync completed.')
      }

      await prisma.$disconnect()
    } catch (e) {
      // DB 연결 실패 시 앱 시작은 계속 진행
      console.error('[instrumentation] Schema check failed:', e instanceof Error ? e.message : e)
    }
  }
}

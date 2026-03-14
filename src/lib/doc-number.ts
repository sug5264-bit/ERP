import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { logger } from '@/lib/logger'

// Prisma 트랜잭션 클라이언트 타입 (prisma.$transaction(async (tx) => ...) 의 tx)
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const MAX_SEQ = 99999

export async function generateDocumentNumber(prefix: string, date?: Date, tx?: TransactionClient): Promise<string> {
  const d = date || new Date()
  const yearMonth = format(d, 'yyyyMM')

  const client = tx || prisma

  // 먼저 현재 시퀀스 값을 확인하여 오버플로우 방지
  const existing = await client.documentSequence.findUnique({
    where: { prefix_yearMonth: { prefix, yearMonth } },
  })

  if (existing && existing.lastSeq >= MAX_SEQ) {
    logger.error('Document sequence overflow', { prefix, yearMonth, lastSeq: existing.lastSeq })
    throw new Error(`문서번호 시퀀스 초과: ${prefix}-${yearMonth} (최대 ${MAX_SEQ})`)
  }

  const sequence = await client.documentSequence.upsert({
    where: {
      prefix_yearMonth: { prefix, yearMonth },
    },
    update: {
      lastSeq: { increment: 1 },
    },
    create: {
      prefix,
      yearMonth,
      lastSeq: 1,
    },
  })

  const seqNo = String(sequence.lastSeq).padStart(5, '0')
  return `${prefix}-${yearMonth}-${seqNo}`
}

import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

// Prisma 트랜잭션 클라이언트 타입 (prisma.$transaction(async (tx) => ...) 의 tx)
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function generateDocumentNumber(prefix: string, date?: Date, tx?: TransactionClient): Promise<string> {
  const d = date || new Date()
  const yearMonth = format(d, 'yyyyMM')

  const client = tx || prisma

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

import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function generateDocumentNumber(prefix: string, date?: Date): Promise<string> {
  const d = date || new Date()
  const yearMonth = format(d, 'yyyyMM')

  const sequence = await prisma.documentSequence.upsert({
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

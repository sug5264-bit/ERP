import { z } from 'zod'

export const createApprovalDocumentSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요').max(200),
  templateId: z.string().max(50).optional().nullable(),
  draftDate: z.string().min(1, '기안일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  content: z.any().optional(),
  relatedModule: z.string().max(50).optional().nullable(),
  relatedDocId: z.string().max(50).optional().nullable(),
  urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).default('NORMAL'),
  steps: z.array(z.object({
    approverId: z.string().min(1, '결재자를 선택하세요').max(50),
    approvalType: z.enum(['APPROVE', 'REVIEW', 'NOTIFY']).default('APPROVE'),
  })).min(1, '최소 1명의 결재자가 필요합니다').max(20),
})

import { z } from 'zod'

export const createApprovalDocumentSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요'),
  templateId: z.string().optional().nullable(),
  draftDate: z.string().min(1, '기안일을 입력하세요'),
  content: z.any().optional(),
  relatedModule: z.string().optional().nullable(),
  relatedDocId: z.string().optional().nullable(),
  urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).default('NORMAL'),
  steps: z.array(z.object({
    approverId: z.string().min(1, '결재자를 선택하세요'),
    approvalType: z.enum(['APPROVE', 'REVIEW', 'NOTIFY']).default('APPROVE'),
  })).min(1, '최소 1명의 결재자가 필요합니다'),
})

export const approvalActionSchema = z.object({
  action: z.enum(['submit', 'approve', 'reject', 'cancel']),
  comment: z.string().optional(),
})

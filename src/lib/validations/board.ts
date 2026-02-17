import { z } from 'zod'

export const createPostSchema = z.object({
  boardId: z.string().min(1, '게시판을 선택하세요').max(50),
  title: z.string().min(1, '제목을 입력하세요').max(200),
  content: z.string().min(1, '내용을 입력하세요').max(50000),
  isPinned: z.boolean().default(false),
})

export const createCommentSchema = z.object({
  postId: z.string().min(1).max(50),
  content: z.string().min(1, '댓글 내용을 입력하세요').max(5000),
  parentCommentId: z.string().max(50).optional().nullable(),
})

export const createMessageSchema = z.object({
  receiverId: z.string().min(1, '수신자를 선택하세요').max(50),
  subject: z.string().min(1, '제목을 입력하세요').max(200),
  content: z.string().min(1, '내용을 입력하세요').max(10000),
})

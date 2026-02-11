import { z } from 'zod'

export const createPostSchema = z.object({
  boardId: z.string().min(1, '게시판을 선택하세요'),
  title: z.string().min(1, '제목을 입력하세요'),
  content: z.string().min(1, '내용을 입력하세요'),
  isPinned: z.boolean().default(false),
})

export const updatePostSchema = createPostSchema.partial()

export const createCommentSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1, '댓글 내용을 입력하세요'),
  parentCommentId: z.string().optional().nullable(),
})

export const createMessageSchema = z.object({
  receiverId: z.string().min(1, '수신자를 선택하세요'),
  subject: z.string().min(1, '제목을 입력하세요'),
  content: z.string().min(1, '내용을 입력하세요'),
})

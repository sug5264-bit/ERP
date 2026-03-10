import { describe, it, expect } from 'vitest'
import { createApprovalDocumentSchema } from '@/lib/validations/approval'
import { createPostSchema, createCommentSchema, createMessageSchema } from '@/lib/validations/board'
import {
  createProjectSchema,
  updateProjectSchema,
  createProjectTaskSchema,
  updateProjectTaskSchema,
  addProjectMemberSchema,
} from '@/lib/validations/project'

// ─── 결재 ───
describe('createApprovalDocumentSchema', () => {
  const validDoc = {
    title: '출장 결재 요청',
    draftDate: '2024-06-15',
    steps: [{ approverId: 'user-1' }],
  }

  it('유효한 결재문서 데이터 통과', () => {
    expect(createApprovalDocumentSchema.safeParse(validDoc).success).toBe(true)
  })

  it('제목 필수 및 길이 제한', () => {
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, title: '' }).success).toBe(false)
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, title: 'a'.repeat(201) }).success).toBe(false)
  })

  it('기안일 형식 검증', () => {
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, draftDate: '' }).success).toBe(false)
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, draftDate: '2024/06/15' }).success).toBe(false)
  })

  it('긴급도 enum', () => {
    for (const u of ['NORMAL', 'URGENT', 'EMERGENCY']) {
      expect(createApprovalDocumentSchema.safeParse({ ...validDoc, urgency: u }).success).toBe(true)
    }
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, urgency: 'INVALID' }).success).toBe(false)
  })

  it('결재자 최소 1명 필수', () => {
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, steps: [] }).success).toBe(false)
  })

  it('결재자 최대 20명', () => {
    const steps = Array.from({ length: 21 }, (_, i) => ({ approverId: `user-${i}` }))
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, steps }).success).toBe(false)
  })

  it('결재유형 enum', () => {
    for (const type of ['APPROVE', 'REVIEW', 'NOTIFY']) {
      expect(
        createApprovalDocumentSchema.safeParse({
          ...validDoc,
          steps: [{ approverId: 'user-1', approvalType: type }],
        }).success
      ).toBe(true)
    }
  })

  it('content는 객체만 허용', () => {
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, content: { key: 'val' } }).success).toBe(true)
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, content: null }).success).toBe(true)
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, content: 'string' }).success).toBe(false)
    expect(createApprovalDocumentSchema.safeParse({ ...validDoc, content: [1, 2] }).success).toBe(false)
  })

  it('관련 모듈/문서 선택적', () => {
    expect(
      createApprovalDocumentSchema.safeParse({
        ...validDoc,
        relatedModule: 'purchase',
        relatedDocId: 'doc-123',
      }).success
    ).toBe(true)
  })
})

// ─── 게시판 ───
describe('createPostSchema', () => {
  const validPost = {
    boardId: 'board-1',
    title: '공지사항',
    content: '내용입니다.',
  }

  it('유효한 게시글 데이터 통과', () => {
    expect(createPostSchema.safeParse(validPost).success).toBe(true)
  })

  it('제목 필수 및 길이 제한', () => {
    expect(createPostSchema.safeParse({ ...validPost, title: '' }).success).toBe(false)
    expect(createPostSchema.safeParse({ ...validPost, title: 'a'.repeat(201) }).success).toBe(false)
  })

  it('내용 필수 및 길이 제한', () => {
    expect(createPostSchema.safeParse({ ...validPost, content: '' }).success).toBe(false)
    expect(createPostSchema.safeParse({ ...validPost, content: 'a'.repeat(50001) }).success).toBe(false)
  })

  it('고정 여부 기본값 false', () => {
    const result = createPostSchema.safeParse(validPost)
    expect(result.success && result.data.isPinned).toBe(false)
  })
})

describe('createCommentSchema', () => {
  it('유효한 댓글 통과', () => {
    expect(createCommentSchema.safeParse({ postId: 'p-1', content: '댓글' }).success).toBe(true)
  })

  it('내용 필수', () => {
    expect(createCommentSchema.safeParse({ postId: 'p-1', content: '' }).success).toBe(false)
  })

  it('대댓글 parentCommentId', () => {
    expect(createCommentSchema.safeParse({ postId: 'p-1', content: '답글', parentCommentId: 'c-1' }).success).toBe(true)
    expect(createCommentSchema.safeParse({ postId: 'p-1', content: '답글', parentCommentId: null }).success).toBe(true)
  })
})

describe('createMessageSchema', () => {
  it('유효한 쪽지 통과', () => {
    expect(createMessageSchema.safeParse({ receiverId: 'u-1', subject: '제목', content: '내용' }).success).toBe(true)
  })

  it('필수 필드 검증', () => {
    expect(createMessageSchema.safeParse({ receiverId: '', subject: '제목', content: '내용' }).success).toBe(false)
    expect(createMessageSchema.safeParse({ receiverId: 'u-1', subject: '', content: '내용' }).success).toBe(false)
    expect(createMessageSchema.safeParse({ receiverId: 'u-1', subject: '제목', content: '' }).success).toBe(false)
  })
})

// ─── 프로젝트 ───
describe('createProjectSchema', () => {
  const validProject = {
    projectCode: 'PRJ-001',
    projectName: 'ERP 개발',
    managerId: 'user-1',
    departmentId: 'dept-1',
    startDate: '2024-01-01',
  }

  it('유효한 프로젝트 데이터 통과', () => {
    expect(createProjectSchema.safeParse(validProject).success).toBe(true)
  })

  it('프로젝트코드 패턴 검증', () => {
    expect(createProjectSchema.safeParse({ ...validProject, projectCode: '한글' }).success).toBe(false)
    expect(createProjectSchema.safeParse({ ...validProject, projectCode: '' }).success).toBe(false)
  })

  it('시작일 필수', () => {
    expect(createProjectSchema.safeParse({ ...validProject, startDate: '' }).success).toBe(false)
    expect(createProjectSchema.safeParse({ ...validProject, startDate: '2024/01/01' }).success).toBe(false)
  })

  it('종료일 선택적', () => {
    expect(createProjectSchema.safeParse({ ...validProject, endDate: '2024-12-31' }).success).toBe(true)
    expect(createProjectSchema.safeParse({ ...validProject, endDate: '' }).success).toBe(true)
  })

  it('예산 범위', () => {
    expect(createProjectSchema.safeParse({ ...validProject, budget: 0 }).success).toBe(true)
    expect(createProjectSchema.safeParse({ ...validProject, budget: -1 }).success).toBe(false)
    expect(createProjectSchema.safeParse({ ...validProject, budget: 1_000_000_000_000 }).success).toBe(false)
  })
})

describe('updateProjectSchema', () => {
  it('부분 업데이트 허용', () => {
    expect(updateProjectSchema.safeParse({ projectName: '수정' }).success).toBe(true)
  })

  it('상태 enum', () => {
    for (const s of ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']) {
      expect(updateProjectSchema.safeParse({ status: s }).success).toBe(true)
    }
    expect(updateProjectSchema.safeParse({ status: 'INVALID' }).success).toBe(false)
  })

  it('진행률 0~100', () => {
    expect(updateProjectSchema.safeParse({ progress: 0 }).success).toBe(true)
    expect(updateProjectSchema.safeParse({ progress: 100 }).success).toBe(true)
    expect(updateProjectSchema.safeParse({ progress: -1 }).success).toBe(false)
    expect(updateProjectSchema.safeParse({ progress: 101 }).success).toBe(false)
  })
})

describe('createProjectTaskSchema', () => {
  const validTask = {
    projectId: 'prj-1',
    taskName: '설계',
  }

  it('유효한 작업 데이터 통과', () => {
    expect(createProjectTaskSchema.safeParse(validTask).success).toBe(true)
  })

  it('우선순위 enum', () => {
    for (const p of ['URGENT', 'HIGH', 'NORMAL', 'LOW']) {
      expect(createProjectTaskSchema.safeParse({ ...validTask, priority: p }).success).toBe(true)
    }
  })

  it('예상시간 범위', () => {
    expect(createProjectTaskSchema.safeParse({ ...validTask, estimatedHours: 0 }).success).toBe(true)
    expect(createProjectTaskSchema.safeParse({ ...validTask, estimatedHours: 9999 }).success).toBe(true)
    expect(createProjectTaskSchema.safeParse({ ...validTask, estimatedHours: 10000 }).success).toBe(false)
  })
})

describe('updateProjectTaskSchema', () => {
  it('상태 enum', () => {
    for (const s of ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']) {
      expect(updateProjectTaskSchema.safeParse({ status: s }).success).toBe(true)
    }
  })

  it('실제시간 범위', () => {
    expect(updateProjectTaskSchema.safeParse({ actualHours: 0 }).success).toBe(true)
    expect(updateProjectTaskSchema.safeParse({ actualHours: -1 }).success).toBe(false)
  })
})

describe('addProjectMemberSchema', () => {
  it('유효한 멤버 추가 통과', () => {
    expect(addProjectMemberSchema.safeParse({ projectId: 'prj-1', employeeId: 'emp-1' }).success).toBe(true)
  })

  it('역할 enum', () => {
    for (const r of ['PM', 'MEMBER', 'REVIEWER']) {
      expect(addProjectMemberSchema.safeParse({ projectId: 'prj-1', employeeId: 'emp-1', role: r }).success).toBe(true)
    }
  })

  it('필수 필드 누락 시 실패', () => {
    expect(addProjectMemberSchema.safeParse({ projectId: 'prj-1', employeeId: '' }).success).toBe(false)
    expect(addProjectMemberSchema.safeParse({ projectId: '', employeeId: 'emp-1' }).success).toBe(false)
  })
})

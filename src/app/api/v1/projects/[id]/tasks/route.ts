import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { createProjectTaskSchema, updateProjectTaskSchema } from '@/lib/validations/project'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('projects', 'create')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    const data = createProjectTaskSchema.parse({ ...body, projectId: id })
    const task = await prisma.projectTask.create({
      data: {
        projectId: id,
        taskName: data.taskName,
        assigneeId: data.assigneeId || null,
        parentTaskId: data.parentTaskId || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        priority: data.priority || 'NORMAL',
        description: data.description || null,
        estimatedHours: data.estimatedHours || null,
      },
    })
    return successResponse(task)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('projects', 'update')
    if (isErrorResponse(authResult)) return authResult
    const { id: projectId } = await params
    const body = await request.json()
    const { taskId, ...rest } = body
    if (!taskId) return errorResponse('taskId가 필요합니다.', 'BAD_REQUEST', 400)

    // 해당 프로젝트에 속한 태스크인지 확인
    const existing = await prisma.projectTask.findFirst({ where: { id: taskId, projectId } })
    if (!existing) return errorResponse('해당 프로젝트의 태스크를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const data = updateProjectTaskSchema.parse(rest)
    const task = await prisma.projectTask.update({ where: { id: taskId }, data })
    return successResponse(task)
  } catch (error) {
    return handleApiError(error)
  }
}

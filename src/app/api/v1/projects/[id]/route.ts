import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { updateProjectSchema } from '@/lib/validations/project'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('projects', 'read')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        members: {
          include: {
            employee: {
              select: {
                id: true,
                nameKo: true,
                department: { select: { name: true } },
                position: { select: { name: true } },
              },
            },
          },
        },
        tasks: { include: { subTasks: true }, orderBy: { createdAt: 'asc' } },
        schedules: { orderBy: { startDateTime: 'asc' } },
      },
    })
    if (!project) return errorResponse('프로젝트를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(project)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('projects', 'update')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    const data = updateProjectSchema.parse(body)
    const updateData: any = { ...data }
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null
    const project = await prisma.project.update({ where: { id }, data: updateData })
    return successResponse(project)
  } catch (error) {
    return handleApiError(error)
  }
}

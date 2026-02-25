import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { addProjectMemberSchema } from '@/lib/validations/project'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('projects', 'create')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    const data = addProjectMemberSchema.parse({ ...body, projectId: id })
    const member = await prisma.projectMember.create({
      data: { projectId: id, employeeId: data.employeeId, role: data.role || 'MEMBER' },
      include: { employee: { select: { id: true, nameKo: true } } },
    })
    return successResponse(member)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('projects', 'delete')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    if (!body.memberId) return errorResponse('memberId가 필요합니다.', 'BAD_REQUEST', 400)
    // 해당 프로젝트에 속한 멤버인지 확인
    const member = await prisma.projectMember.findFirst({
      where: { id: body.memberId, projectId: id },
    })
    if (!member) return errorResponse('해당 프로젝트의 멤버를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    await prisma.projectMember.delete({ where: { id: body.memberId } })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'
import { addProjectMemberSchema } from '@/lib/validations/project'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const body = await request.json()
    const data = addProjectMemberSchema.parse({ ...body, projectId: id })
    const member = await prisma.projectMember.create({
      data: { projectId: id, employeeId: data.employeeId, role: data.role || 'MEMBER' },
      include: { employee: { select: { id: true, nameKo: true } } },
    })
    return successResponse(member)
  } catch (error) { return handleApiError(error) }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    if (!body.memberId) return errorResponse('memberId가 필요합니다.', 'BAD_REQUEST', 400)
    await prisma.projectMember.delete({ where: { id: body.memberId } })
    return successResponse({ deleted: true })
  } catch (error) { return handleApiError(error) }
}

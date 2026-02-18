import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createProjectSchema } from '@/lib/validations/project'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const search = sp.get('search') || ''
    const status = sp.get('status') || ''
    const where: any = {}
    if (search) where.projectName = { contains: search, mode: 'insensitive' }
    if (status) where.status = status
    const [items, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { tasks: true, members: true } },
        },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.project.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createProjectSchema.parse(body)
    const project = await prisma.project.create({
      data: {
        projectCode: data.projectCode, projectName: data.projectName,
        managerId: data.managerId, departmentId: data.departmentId,
        startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : null,
        budget: data.budget || null, description: data.description || null,
      },
    })
    return successResponse(project)
  } catch (error) { return handleApiError(error) }
}

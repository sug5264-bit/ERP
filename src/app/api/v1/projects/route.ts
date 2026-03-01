import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createProjectSchema } from '@/lib/validations/project'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('projects', 'read')
    if (isErrorResponse(authResult)) return authResult
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const rawSearch = sp.get('search') || ''
    const status = sp.get('status') || ''
    const where: Record<string, unknown> = {}
    if (rawSearch) {
      const search = sanitizeSearchQuery(rawSearch)
      where.projectName = { contains: search, mode: 'insensitive' }
    }
    if (status) where.status = status
    const [items, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { tasks: true, members: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.project.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('projects', 'create')
    if (isErrorResponse(authResult)) return authResult
    const body = await request.json()
    const data = createProjectSchema.parse(body)
    const project = await prisma.project.create({
      data: {
        projectCode: data.projectCode,
        projectName: data.projectName,
        managerId: data.managerId,
        departmentId: data.departmentId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        budget: data.budget || null,
        description: data.description || null,
      },
    })
    return successResponse(project)
  } catch (error) {
    return handleApiError(error)
  }
}

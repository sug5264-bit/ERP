import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'
import { updatePartnerSchema } from '@/lib/validations/inventory'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    const partner = await prisma.partner.findUnique({ where: { id } })
    if (!partner) return errorResponse('거래처를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(partner)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()
    const data = updatePartnerSchema.parse(body)

    const partner = await prisma.partner.update({ where: { id }, data })
    return successResponse(partner)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    await prisma.partner.delete({ where: { id } })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}

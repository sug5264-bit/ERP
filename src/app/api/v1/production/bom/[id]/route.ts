import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('production', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params

    const bom = await prisma.bomHeader.findUnique({
      where: { id },
      include: {
        item: { select: { itemName: true } },
        details: {
          orderBy: { lineNo: 'asc' },
          include: {
            item: { select: { itemName: true, itemCode: true, barcode: true, unit: true } },
          },
        },
      },
    })

    if (!bom) return errorResponse('BOM을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const mapped = {
      ...bom,
      productName: bom.item?.itemName || '',
      version: `v${bom.version}.0`,
      status: bom.isActive ? 'ACTIVE' : 'INACTIVE',
      yieldRate: Number(bom.yieldRate),
      materials: bom.details.map((d) => ({
        id: d.id,
        barcode: d.item?.barcode || '',
        itemName: d.item?.itemName || '',
        itemCode: d.item?.itemCode || '',
        quantity: Number(d.quantity),
        unit: d.unit,
        lossRate: Number(d.lossRate),
      })),
    }

    return successResponse(mapped)
  } catch (error) {
    return handleApiError(error)
  }
}

const updateBomSchema = z.object({
  bomName: z.string().min(1).optional(),
  itemId: z.string().min(1).optional(),
  productName: z.string().optional(),
  version: z.union([z.number().int(), z.string()]).optional(),
  yieldRate: z.number().optional(),
  isActive: z.boolean().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  details: z
    .array(
      z.object({
        lineNo: z.number().int(),
        itemId: z.string().min(1),
        quantity: z.number(),
        unit: z.string().optional(),
        lossRate: z.number().optional(),
        remark: z.string().optional(),
      })
    )
    .optional(),
})

export async function PUT(request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('production', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params
    const body = await request.json()
    const data = updateBomSchema.parse(body)

    const { details, productName, status, version: versionRaw, ...headerData } = data

    // Resolve productName to itemId if needed
    if (productName && !headerData.itemId) {
      const item = await prisma.item.findFirst({
        where: { itemName: { contains: productName, mode: 'insensitive' } },
      })
      if (item) headerData.itemId = item.id
    }

    // Parse version string
    const version =
      typeof versionRaw === 'string' ? parseInt(versionRaw.replace(/[^0-9]/g, ''), 10) || undefined : versionRaw

    // Map status to isActive
    const isActive = status ? status === 'ACTIVE' : headerData.isActive

    const bom = await prisma.bomHeader.update({
      where: { id },
      data: {
        ...headerData,
        ...(version !== undefined ? { version } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(details
          ? {
              details: {
                deleteMany: {},
                create: details,
              },
            }
          : {}),
      },
      include: { details: true },
    })

    return successResponse(bom)
  } catch (error) {
    return handleApiError(error)
  }
}

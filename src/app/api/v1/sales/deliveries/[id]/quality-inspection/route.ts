import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { createQualityInspectionSchema } from '@/lib/validations/sales'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params

    const inspections = await prisma.qualityInspection.findMany({
      where: { deliveryId: id },
      include: {
        items: { orderBy: { category: 'asc' } },
        delivery: {
          select: {
            deliveryNo: true,
            deliveryDate: true,
            partner: { select: { partnerName: true } },
            details: { include: { item: { select: { itemName: true, specification: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(inspections)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params

    const body = await request.json()
    const data = createQualityInspectionSchema.parse({ ...body, deliveryId: id })

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      select: { id: true, deliveryNo: true },
    })
    if (!delivery) return errorResponse('납품을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const inspectionNo = await generateDocumentNumber('QI', new Date(data.inspectionDate))
    // 불량률을 비율(0~1)로 계산 — Decimal(8,4)에 안전하게 저장
    const defectRate = data.sampleSize > 0 ? Math.min(9999.9999, (data.defectCount / data.sampleSize) * 100) : 0

    const result = await prisma.$transaction(async (tx) => {
      const inspection = await tx.qualityInspection.create({
        data: {
          inspectionNo,
          deliveryId: id,
          inspectionDate: new Date(data.inspectionDate),
          inspectorName: data.inspectorName,
          overallGrade: data.overallGrade,
          status: 'COMPLETED',
          sampleSize: data.sampleSize,
          defectCount: data.defectCount,
          defectRate,
          lotNo: data.lotNo || null,
          judgement: data.judgement,
          remarks: data.remarks || null,
          items: {
            create: data.items.map((item) => ({
              category: item.category,
              checkItem: item.checkItem,
              spec: item.spec || null,
              measuredValue: item.measuredValue || null,
              result: item.result,
              grade: item.grade,
              defectType: item.defectType || null,
              remarks: item.remarks || null,
            })),
          },
        },
        include: { items: true },
      })

      // 납품의 품질 상태 업데이트
      await tx.delivery.update({
        where: { id },
        data: { qualityStatus: data.judgement },
      })

      return inspection
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

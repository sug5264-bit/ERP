import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const sp = request.nextUrl.searchParams
    const year = parseInt(sp.get('year') || String(new Date().getFullYear()))
    const month = sp.get('month') ? parseInt(sp.get('month')!) : null

    const startDate = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1)
    const endDate = month
      ? new Date(year, month, 1)
      : new Date(year + 1, 0, 1)

    const where = {
      orderDate: { gte: startDate, lt: endDate },
      status: { not: 'CANCELLED' as const },
    }

    // Channel summary
    const [onlineOrders, offlineOrders] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: { ...where, salesChannel: 'ONLINE' },
        _count: true,
        _sum: { totalAmount: true, totalSupply: true, totalTax: true },
      }),
      prisma.salesOrder.aggregate({
        where: { ...where, salesChannel: 'OFFLINE' },
        _count: true,
        _sum: { totalAmount: true, totalSupply: true, totalTax: true },
      }),
    ])

    // Monthly breakdown
    const allOrders = await prisma.salesOrder.findMany({
      where,
      select: {
        orderDate: true,
        salesChannel: true,
        totalAmount: true,
        totalSupply: true,
      },
      orderBy: { orderDate: 'asc' },
    })

    const monthlyMap = new Map<string, { online: number; offline: number; total: number }>()
    for (const order of allOrders) {
      const key = `${order.orderDate.getFullYear()}-${String(order.orderDate.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyMap.has(key)) monthlyMap.set(key, { online: 0, offline: 0, total: 0 })
      const entry = monthlyMap.get(key)!
      const amount = Number(order.totalAmount)
      if (order.salesChannel === 'ONLINE') entry.online += amount
      else entry.offline += amount
      entry.total += amount
    }

    const monthly = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      ...data,
    }))

    // Top items by channel
    const topItemsRaw = await prisma.salesOrderDetail.findMany({
      where: { salesOrder: { ...where } },
      select: {
        item: { select: { itemCode: true, itemName: true } },
        totalAmount: true,
        quantity: true,
        salesOrder: { select: { salesChannel: true } },
      },
    })

    const itemMap = new Map<string, { itemCode: string; itemName: string; online: number; offline: number; total: number; qty: number }>()
    for (const d of topItemsRaw) {
      const key = d.item.itemCode
      if (!itemMap.has(key)) itemMap.set(key, { itemCode: d.item.itemCode, itemName: d.item.itemName, online: 0, offline: 0, total: 0, qty: 0 })
      const entry = itemMap.get(key)!
      const amount = Number(d.totalAmount)
      const qty = Number(d.quantity)
      if (d.salesOrder.salesChannel === 'ONLINE') entry.online += amount
      else entry.offline += amount
      entry.total += amount
      entry.qty += qty
    }

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    return successResponse({
      period: { year, month },
      online: {
        count: onlineOrders._count,
        totalAmount: Number(onlineOrders._sum.totalAmount || 0),
        totalSupply: Number(onlineOrders._sum.totalSupply || 0),
        totalTax: Number(onlineOrders._sum.totalTax || 0),
      },
      offline: {
        count: offlineOrders._count,
        totalAmount: Number(offlineOrders._sum.totalAmount || 0),
        totalSupply: Number(offlineOrders._sum.totalSupply || 0),
        totalTax: Number(offlineOrders._sum.totalTax || 0),
      },
      total: {
        count: onlineOrders._count + offlineOrders._count,
        totalAmount: Number(onlineOrders._sum.totalAmount || 0) + Number(offlineOrders._sum.totalAmount || 0),
      },
      monthly,
      topItems,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

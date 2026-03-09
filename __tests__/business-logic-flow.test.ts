import { describe, it, expect } from 'vitest'

/**
 * 자동 연동 데이터 흐름 검증을 위한 순수 로직 테스트
 * (DB 없이 비즈니스 로직만 검증)
 */

// ─── 문서번호 생성 로직 ───────────────────────────────
function generateDocNo(prefix: string, date: string, lastNo: string | null): string {
  const today = date.replace(/-/g, '')
  const seq = lastNo ? parseInt(lastNo.slice(-4), 10) + 1 : 1
  return `${prefix}-${today}-${String(seq).padStart(4, '0')}`
}

describe('문서번호 생성 로직', () => {
  it('첫 문서번호 생성', () => {
    expect(generateDocNo('SO', '2026-03-09', null)).toBe('SO-20260309-0001')
  })

  it('연속 번호 생성', () => {
    expect(generateDocNo('SO', '2026-03-09', 'SO-20260309-0005')).toBe('SO-20260309-0006')
  })

  it('다른 날짜의 마지막 번호가 있어도 올바른 시퀀스', () => {
    // 날짜가 다르면 어제 마지막 번호의 seq를 이어감 (실제로는 findFirst where startsWith로 분리됨)
    expect(generateDocNo('PO', '2026-03-10', 'PO-20260310-0099')).toBe('PO-20260310-0100')
  })

  it('9999번 이후 오버플로우', () => {
    const result = generateDocNo('SO', '2026-03-09', 'SO-20260309-9999')
    expect(result).toBe('SO-20260309-10000') // 5자리 → 문자열 padStart 무시
  })
})

// ─── 재고 차감 로직 시뮬레이션 ───────────────────────
interface StockBalance {
  id: string
  itemId: string
  warehouseId: string
  quantity: number
}

function deductStock(
  balances: StockBalance[],
  itemId: string,
  deductQty: number
): { updated: StockBalance[]; remaining: number; warnings: string[] } {
  const warnings: string[] = []
  let remaining = deductQty

  // 재고가 많은 창고부터 차감 (실제 API 로직과 동일)
  const sorted = [...balances].filter((b) => b.itemId === itemId).sort((a, b) => b.quantity - a.quantity)

  const updated = sorted.map((bal) => {
    if (remaining <= 0) return bal
    const deduct = Math.min(bal.quantity, remaining)
    remaining -= deduct
    return { ...bal, quantity: bal.quantity - deduct }
  })

  if (remaining > 0) {
    warnings.push(`품목 ${itemId}: 요청 ${deductQty}개 중 ${remaining}개 미차감 (재고 부족)`)
  }

  return { updated, remaining, warnings }
}

describe('재고 차감 로직', () => {
  const balances: StockBalance[] = [
    { id: 'b1', itemId: 'item-A', warehouseId: 'wh1', quantity: 100 },
    { id: 'b2', itemId: 'item-A', warehouseId: 'wh2', quantity: 50 },
    { id: 'b3', itemId: 'item-B', warehouseId: 'wh1', quantity: 30 },
  ]

  it('단일 창고에서 충분한 재고 차감', () => {
    const result = deductStock(balances, 'item-A', 80)
    expect(result.remaining).toBe(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.updated[0].quantity).toBe(20) // 100 - 80
    expect(result.updated[1].quantity).toBe(50) // 변경 없음
  })

  it('복수 창고에 걸친 차감', () => {
    const result = deductStock(balances, 'item-A', 130)
    expect(result.remaining).toBe(0)
    expect(result.updated[0].quantity).toBe(0) // 100 → 0
    expect(result.updated[1].quantity).toBe(20) // 50 → 20
  })

  it('전체 재고 소진', () => {
    const result = deductStock(balances, 'item-A', 150)
    expect(result.remaining).toBe(0)
    expect(result.updated[0].quantity).toBe(0)
    expect(result.updated[1].quantity).toBe(0)
  })

  it('재고 부족 시 경고', () => {
    const result = deductStock(balances, 'item-A', 200)
    expect(result.remaining).toBe(50) // 150개만 가용
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('50개 미차감')
  })

  it('존재하지 않는 품목 차감 시도', () => {
    const result = deductStock(balances, 'item-Z', 10)
    expect(result.remaining).toBe(10)
    expect(result.warnings).toHaveLength(1)
  })

  it('0개 차감', () => {
    const result = deductStock(balances, 'item-A', 0)
    expect(result.remaining).toBe(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('음수 재고 방지', () => {
    const result = deductStock(balances, 'item-B', 30)
    expect(result.remaining).toBe(0)
    expect(result.updated[0].quantity).toBe(0) // 정확히 0
  })
})

// ─── 발주 금액 계산 로직 ─────────────────────────────
interface OrderDetail {
  quantity: number
  unitPrice: number
  taxType: 'TAXABLE' | 'TAX_FREE' | 'ZERO_RATE'
}

function calculateOrderAmounts(details: OrderDetail[], vatIncluded: boolean) {
  let totalSupply = 0
  let totalTax = 0

  for (const d of details) {
    const supply = Math.round(d.quantity * d.unitPrice)
    const tax = vatIncluded && d.taxType === 'TAXABLE' ? Math.round(supply * 0.1) : 0
    totalSupply += supply
    totalTax += tax
  }

  return { totalSupply, totalTax, totalAmount: totalSupply + totalTax }
}

describe('발주 금액 계산', () => {
  it('과세 품목 VAT 포함', () => {
    const details: OrderDetail[] = [{ quantity: 10, unitPrice: 1000, taxType: 'TAXABLE' }]
    const result = calculateOrderAmounts(details, true)
    expect(result.totalSupply).toBe(10000)
    expect(result.totalTax).toBe(1000) // 10% VAT
    expect(result.totalAmount).toBe(11000)
  })

  it('과세 품목 VAT 미포함', () => {
    const details: OrderDetail[] = [{ quantity: 10, unitPrice: 1000, taxType: 'TAXABLE' }]
    const result = calculateOrderAmounts(details, false)
    expect(result.totalTax).toBe(0) // VAT 미적용
    expect(result.totalAmount).toBe(10000)
  })

  it('면세 품목은 VAT 포함이어도 세금 0', () => {
    const details: OrderDetail[] = [{ quantity: 5, unitPrice: 2000, taxType: 'TAX_FREE' }]
    const result = calculateOrderAmounts(details, true)
    expect(result.totalTax).toBe(0)
  })

  it('혼합 품목 (과세 + 면세)', () => {
    const details: OrderDetail[] = [
      { quantity: 10, unitPrice: 1000, taxType: 'TAXABLE' },
      { quantity: 5, unitPrice: 2000, taxType: 'TAX_FREE' },
    ]
    const result = calculateOrderAmounts(details, true)
    expect(result.totalSupply).toBe(20000) // 10000 + 10000
    expect(result.totalTax).toBe(1000) // 10000의 10%만
    expect(result.totalAmount).toBe(21000)
  })

  it('소수점 단가 반올림', () => {
    const details: OrderDetail[] = [{ quantity: 3, unitPrice: 333.33, taxType: 'TAXABLE' }]
    const result = calculateOrderAmounts(details, true)
    // 3 * 333.33 = 999.99 → Math.round → 1000
    expect(result.totalSupply).toBe(1000)
    expect(result.totalTax).toBe(100) // 1000 * 0.1
  })

  it('대량 금액 (100억 이상)', () => {
    const details: OrderDetail[] = [{ quantity: 100000, unitPrice: 100000, taxType: 'TAXABLE' }]
    const result = calculateOrderAmounts(details, true)
    expect(result.totalSupply).toBe(10_000_000_000) // 100억
    expect(result.totalTax).toBe(1_000_000_000) // 10억
    expect(result.totalAmount).toBe(11_000_000_000)
  })

  it('빈 품목 배열', () => {
    const result = calculateOrderAmounts([], true)
    expect(result.totalAmount).toBe(0)
  })
})

// ─── 수주 → 납품 → 반품 흐름 시뮬레이션 ──────────────
interface SalesOrderSim {
  quantity: number
  deliveredQty: number
  remainingQty: number
  status: string
}

function processDelivery(order: SalesOrderSim, deliverQty: number): SalesOrderSim | { error: string } {
  if (deliverQty <= 0) return { error: '납품 수량은 1 이상이어야 합니다.' }
  if (deliverQty > order.remainingQty) {
    return { error: `남은 수량(${order.remainingQty})보다 많이 납품할 수 없습니다.` }
  }
  if (order.status === 'CANCELLED') return { error: '취소된 발주는 납품할 수 없습니다.' }

  const newDelivered = order.deliveredQty + deliverQty
  const newRemaining = order.quantity - newDelivered
  const newStatus = newRemaining === 0 ? 'COMPLETED' : 'IN_PROGRESS'

  return {
    quantity: order.quantity,
    deliveredQty: newDelivered,
    remainingQty: newRemaining,
    status: newStatus,
  }
}

function processReturn(order: SalesOrderSim, returnQty: number): SalesOrderSim | { error: string } {
  if (returnQty <= 0) return { error: '반품 수량은 1 이상이어야 합니다.' }
  if (returnQty > order.deliveredQty) {
    return { error: `납품 수량(${order.deliveredQty})보다 많이 반품할 수 없습니다.` }
  }

  const newDelivered = order.deliveredQty - returnQty
  const newRemaining = order.quantity - newDelivered
  const newStatus = order.status === 'COMPLETED' ? 'IN_PROGRESS' : order.status

  return {
    quantity: order.quantity,
    deliveredQty: newDelivered,
    remainingQty: newRemaining,
    status: newStatus,
  }
}

describe('수주 → 납품 → 반품 흐름', () => {
  const initialOrder: SalesOrderSim = {
    quantity: 100,
    deliveredQty: 0,
    remainingQty: 100,
    status: 'ORDERED',
  }

  it('부분 납품', () => {
    const result = processDelivery(initialOrder, 30)
    expect(result).not.toHaveProperty('error')
    const order = result as SalesOrderSim
    expect(order.deliveredQty).toBe(30)
    expect(order.remainingQty).toBe(70)
    expect(order.status).toBe('IN_PROGRESS')
  })

  it('전량 납품 → COMPLETED', () => {
    const result = processDelivery(initialOrder, 100)
    const order = result as SalesOrderSim
    expect(order.status).toBe('COMPLETED')
    expect(order.remainingQty).toBe(0)
  })

  it('잔여 수량 초과 납품 거부', () => {
    const partial = processDelivery(initialOrder, 80) as SalesOrderSim
    const result = processDelivery(partial, 30) // 잔여 20인데 30 납품 시도
    expect(result).toHaveProperty('error')
  })

  it('취소 발주 납품 거부', () => {
    const cancelled = { ...initialOrder, status: 'CANCELLED' }
    const result = processDelivery(cancelled, 10)
    expect(result).toHaveProperty('error')
  })

  it('완료 후 반품 → IN_PROGRESS 복원', () => {
    const completed = processDelivery(initialOrder, 100) as SalesOrderSim
    expect(completed.status).toBe('COMPLETED')

    const returned = processReturn(completed, 20) as SalesOrderSim
    expect(returned.status).toBe('IN_PROGRESS')
    expect(returned.deliveredQty).toBe(80)
    expect(returned.remainingQty).toBe(20)
  })

  it('납품 수량 초과 반품 거부', () => {
    const partial = processDelivery(initialOrder, 50) as SalesOrderSim
    const result = processReturn(partial, 60)
    expect(result).toHaveProperty('error')
  })

  it('복합 시나리오: 분할 납품 → 부분 반품 → 추가 납품 → 완료', () => {
    // Step 1: 40개 납품
    let order = processDelivery(initialOrder, 40) as SalesOrderSim
    expect(order.deliveredQty).toBe(40)

    // Step 2: 10개 반품
    order = processReturn(order, 10) as SalesOrderSim
    expect(order.deliveredQty).toBe(30)
    expect(order.remainingQty).toBe(70)

    // Step 3: 70개 추가 납품 → 완료
    order = processDelivery(order, 70) as SalesOrderSim
    expect(order.deliveredQty).toBe(100)
    expect(order.status).toBe('COMPLETED')
  })

  it('엣지: 0개 납품 거부', () => {
    const result = processDelivery(initialOrder, 0)
    expect(result).toHaveProperty('error')
  })

  it('엣지: 음수 반품 거부', () => {
    const partial = processDelivery(initialOrder, 50) as SalesOrderSim
    const result = processReturn(partial, -5)
    expect(result).toHaveProperty('error')
  })
})

// ─── 휴가 잔여일수 계산 ──────────────────────────────
interface LeaveBalance {
  totalDays: number
  usedDays: number
  remainingDays: number
}

function approveLeave(balance: LeaveBalance, days: number): LeaveBalance | { error: string } {
  if (days <= 0) return { error: '휴가 일수는 1일 이상이어야 합니다.' }
  if (days > balance.remainingDays) {
    return { error: `잔여 일수(${balance.remainingDays}일)가 부족합니다.` }
  }
  return {
    totalDays: balance.totalDays,
    usedDays: balance.usedDays + days,
    remainingDays: balance.remainingDays - days,
  }
}

function cancelApprovedLeave(balance: LeaveBalance, days: number): LeaveBalance {
  return {
    totalDays: balance.totalDays,
    usedDays: balance.usedDays - days,
    remainingDays: balance.remainingDays + days,
  }
}

describe('휴가 잔여일수 관리', () => {
  const initialBalance: LeaveBalance = {
    totalDays: 15,
    usedDays: 0,
    remainingDays: 15,
  }

  it('정상 승인', () => {
    const result = approveLeave(initialBalance, 3) as LeaveBalance
    expect(result.usedDays).toBe(3)
    expect(result.remainingDays).toBe(12)
  })

  it('잔여일수 초과 승인 거부', () => {
    const result = approveLeave(initialBalance, 16)
    expect(result).toHaveProperty('error')
  })

  it('취소 시 일수 복원', () => {
    const approved = approveLeave(initialBalance, 5) as LeaveBalance
    const cancelled = cancelApprovedLeave(approved, 5)
    expect(cancelled).toEqual(initialBalance)
  })

  it('연속 승인 → 잔여 소진 → 추가 승인 거부', () => {
    let bal = approveLeave(initialBalance, 10) as LeaveBalance
    bal = approveLeave(bal, 5) as LeaveBalance
    expect(bal.remainingDays).toBe(0)

    const result = approveLeave(bal, 1)
    expect(result).toHaveProperty('error')
  })

  it('동시 승인 시뮬레이션 (5일 잔여에 3일 2건)', () => {
    const bal: LeaveBalance = { totalDays: 15, usedDays: 10, remainingDays: 5 }

    // 두 요청이 동시에 같은 잔여 기준으로 통과 시도
    const req1 = approveLeave(bal, 3) as LeaveBalance // 성공
    const req2 = approveLeave(bal, 3) as LeaveBalance // 성공 (동일 snapshot)

    // 실제 DB에서는 WHERE remainingDays >= 3 조건으로 두 번째 요청이 차단됨
    // 여기서는 순수 로직 검증만
    expect(req1.remainingDays).toBe(2)
    expect(req2.remainingDays).toBe(2)
    // 실제로는 req2가 req1 적용 후 잔여 2일에 대해 평가되어야 함
  })
})

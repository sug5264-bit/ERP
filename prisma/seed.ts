import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const adminRole = await prisma.role.upsert({
    where: { name: '관리자' },
    update: {},
    create: { name: '관리자', description: '시스템 관리자' },
  })

  await prisma.role.upsert({
    where: { name: '일반사용자' },
    update: {},
    create: { name: '일반사용자', description: '일반 사용자' },
  })

  const dept = await prisma.department.upsert({
    where: { code: 'MGMT' },
    update: {},
    create: { code: 'MGMT', name: '경영지원팀', isActive: true },
  })

  const position = await prisma.position.upsert({
    where: { code: 'CEO' },
    update: {},
    create: { code: 'CEO', name: '대표이사', level: 1 },
  })

  const passwordHash = await bcrypt.hash('admin1234', 10)

  // Create employee first
  const employee = await prisma.employee.upsert({
    where: { employeeNo: 'EMP-001' },
    update: {},
    create: {
      employeeNo: 'EMP-001', nameKo: '관리자',
      departmentId: dept.id, positionId: position.id,
      joinDate: new Date(),
    },
  })

  // Create admin user linked to employee
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin', email: 'admin@wellgreen.co.kr',
      passwordHash, name: '관리자', isActive: true,
      employeeId: employee.id,
    },
  })

  // Assign admin role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  })

  console.log('Admin: username=admin, password=admin1234')

  const accounts = [
    { code: '1010', nameKo: '현금', accountType: 'ASSET' as const, level: 2 },
    { code: '1020', nameKo: '보통예금', accountType: 'ASSET' as const, level: 2 },
    { code: '1100', nameKo: '매출채권', accountType: 'ASSET' as const, level: 2 },
    { code: '1200', nameKo: '재고자산', accountType: 'ASSET' as const, level: 2 },
    { code: '2100', nameKo: '매입채무', accountType: 'LIABILITY' as const, level: 2 },
    { code: '2200', nameKo: '미지급금', accountType: 'LIABILITY' as const, level: 2 },
    { code: '3100', nameKo: '자본금', accountType: 'EQUITY' as const, level: 2 },
    { code: '4100', nameKo: '매출', accountType: 'REVENUE' as const, level: 2 },
    { code: '5100', nameKo: '매출원가', accountType: 'EXPENSE' as const, level: 2 },
    { code: '5200', nameKo: '급여', accountType: 'EXPENSE' as const, level: 2 },
  ]

  for (const acc of accounts) {
    await prisma.accountSubject.upsert({ where: { code: acc.code }, update: {}, create: acc })
  }

  const currentYear = new Date().getFullYear()
  await prisma.fiscalYear.upsert({
    where: { year: currentYear },
    update: {},
    create: {
      year: currentYear,
      startDate: new Date(`${currentYear}-01-01`),
      endDate: new Date(`${currentYear}-12-31`),
      isClosed: false,
    },
  })

  console.log('Seed completed!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
})

async function main() {
  console.log('Seeding database...')

  // ============================================================
  // 1. 역할 (Roles)
  // ============================================================
  const adminRole = await prisma.role.upsert({
    where: { name: '관리자' },
    update: {},
    create: { name: '관리자', description: '시스템 관리자', isSystem: true },
  })
  const userRole = await prisma.role.upsert({
    where: { name: '일반사용자' },
    update: {},
    create: { name: '일반사용자', description: '일반 사용자' },
  })
  const managerRole = await prisma.role.upsert({
    where: { name: '부서장' },
    update: {},
    create: { name: '부서장', description: '부서 관리자' },
  })
  const hrManagerRole = await prisma.role.upsert({
    where: { name: '인사 관리자' },
    update: {},
    create: { name: '인사 관리자', description: '인사 모듈 관리자' },
  })
  const financeManagerRole = await prisma.role.upsert({
    where: { name: '재무 관리자' },
    update: {},
    create: { name: '재무 관리자', description: '회계/재무 모듈 관리자' },
  })

  // ============================================================
  // 1-2. 권한 (Permissions) - 모듈 및 하위 페이지별
  // ============================================================
  const modules = [
    'accounting',
    'accounting.vouchers',
    'accounting.journal',
    'accounting.ledger',
    'accounting.financial',
    'accounting.tax',
    'accounting.budget',
    'hr',
    'hr.employees',
    'hr.organization',
    'hr.attendance',
    'hr.leave',
    'hr.payroll',
    'hr.recruitment',
    'inventory',
    'inventory.items',
    'inventory.stock',
    'inventory.status',
    'inventory.warehouses',
    'sales',
    'sales.summary',
    'sales.partners',
    'sales.quotations',
    'sales.orders',
    'sales.deliveries',
    'closing',
    'closing.netting',
    'closing.payments',
    'projects',
    'approval',
    'approval.draft',
    'approval.pending',
    'approval.completed',
    'approval.rejected',
    'board',
    'board.notices',
    'board.general',
    'board.messages',
    'admin',
    'admin.users',
    'admin.roles',
    'admin.codes',
    'admin.logs',
  ]
  const actions = ['read', 'create', 'update', 'delete']

  const permMap: Record<string, any> = {}
  for (const mod of modules) {
    for (const action of actions) {
      const perm = await prisma.permission.upsert({
        where: { module_action: { module: mod, action } },
        update: {},
        create: { module: mod, action, description: `${mod} ${action}` },
      })
      permMap[`${mod}:${action}`] = perm
    }
  }

  // 관리자 역할에 모든 권한 할당
  const allPermIds = Object.values(permMap).map((p: any) => p.id)
  for (const permId of allPermIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permId } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permId },
    })
  }

  // 인사 관리자 역할: 인사 모듈 전체 (휴가관리 제외)
  const hrManagerModules = ['hr', 'hr.employees', 'hr.organization', 'hr.attendance', 'hr.payroll', 'hr.recruitment']
  for (const mod of hrManagerModules) {
    for (const action of actions) {
      const key = `${mod}:${action}`
      if (permMap[key]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: hrManagerRole.id, permissionId: permMap[key].id } },
          update: {},
          create: { roleId: hrManagerRole.id, permissionId: permMap[key].id },
        })
      }
    }
  }
  // 인사 관리자도 게시판/결재/프로젝트 접근
  for (const mod of [
    'board',
    'board.notices',
    'board.general',
    'board.messages',
    'approval',
    'approval.draft',
    'approval.pending',
    'approval.completed',
    'approval.rejected',
    'projects',
  ]) {
    for (const action of ['read', 'create']) {
      const key = `${mod}:${action}`
      if (permMap[key]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: hrManagerRole.id, permissionId: permMap[key].id } },
          update: {},
          create: { roleId: hrManagerRole.id, permissionId: permMap[key].id },
        })
      }
    }
  }

  // 재무 관리자 역할: 회계 + 마감 모듈 전체
  const financeManagerModules = [
    'accounting',
    'accounting.vouchers',
    'accounting.journal',
    'accounting.ledger',
    'accounting.financial',
    'accounting.tax',
    'accounting.budget',
    'closing',
    'closing.netting',
    'closing.payments',
  ]
  for (const mod of financeManagerModules) {
    for (const action of actions) {
      const key = `${mod}:${action}`
      if (permMap[key]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: financeManagerRole.id, permissionId: permMap[key].id } },
          update: {},
          create: { roleId: financeManagerRole.id, permissionId: permMap[key].id },
        })
      }
    }
  }
  // 재무 관리자도 게시판/결재/프로젝트 접근
  for (const mod of [
    'board',
    'board.notices',
    'board.general',
    'board.messages',
    'approval',
    'approval.draft',
    'approval.pending',
    'approval.completed',
    'approval.rejected',
    'projects',
  ]) {
    for (const action of ['read', 'create']) {
      const key = `${mod}:${action}`
      if (permMap[key]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: financeManagerRole.id, permissionId: permMap[key].id } },
          update: {},
          create: { roleId: financeManagerRole.id, permissionId: permMap[key].id },
        })
      }
    }
  }

  // 부서장 역할: 재고/매출/마감/프로젝트 + 게시판/결재 + 휴가관리
  const managerModules = [
    'inventory',
    'sales',
    'closing',
    'projects',
    'hr.leave',
    'approval',
    'approval.draft',
    'approval.pending',
    'approval.completed',
    'approval.rejected',
    'board',
    'board.notices',
    'board.general',
    'board.messages',
  ]
  for (const mod of managerModules) {
    for (const action of actions) {
      const key = `${mod}:${action}`
      if (permMap[key]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: managerRole.id, permissionId: permMap[key].id } },
          update: {},
          create: { roleId: managerRole.id, permissionId: permMap[key].id },
        })
      }
    }
  }

  // 일반사용자 역할: 게시판, 결재, 프로젝트, 휴가관리
  const userModules = [
    'board',
    'board.notices',
    'board.general',
    'board.messages',
    'approval',
    'approval.draft',
    'approval.pending',
    'approval.completed',
    'approval.rejected',
    'projects',
    'hr.leave',
  ]
  for (const mod of userModules) {
    for (const action of ['read', 'create']) {
      const key = `${mod}:${action}`
      if (permMap[key]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: userRole.id, permissionId: permMap[key].id } },
          update: {},
          create: { roleId: userRole.id, permissionId: permMap[key].id },
        })
      }
    }
  }

  console.log(`Created ${Object.keys(permMap).length} permissions`)

  // ============================================================
  // 2. 부서 (Departments)
  // ============================================================
  const deptMgmt = await prisma.department.upsert({
    where: { code: 'MGMT' },
    update: {},
    create: { code: 'MGMT', name: '경영지원팀', level: 1, sortOrder: 1 },
  })
  const deptSales = await prisma.department.upsert({
    where: { code: 'SALES' },
    update: {},
    create: { code: 'SALES', name: '영업팀', level: 1, sortOrder: 2 },
  })
  const deptDev = await prisma.department.upsert({
    where: { code: 'DEV' },
    update: {},
    create: { code: 'DEV', name: '개발팀', level: 1, sortOrder: 3 },
  })
  const deptProd = await prisma.department.upsert({
    where: { code: 'PROD' },
    update: {},
    create: { code: 'PROD', name: '생산팀', level: 1, sortOrder: 4 },
  })
  const deptPurchase = await prisma.department.upsert({
    where: { code: 'PURCHASE' },
    update: {},
    create: { code: 'PURCHASE', name: '구매팀', level: 1, sortOrder: 5 },
  })
  const deptAccounting = await prisma.department.upsert({
    where: { code: 'ACCT' },
    update: {},
    create: { code: 'ACCT', name: '회계팀', level: 1, sortOrder: 6 },
  })

  // ============================================================
  // 3. 직급 (Positions)
  // ============================================================
  const posCEO = await prisma.position.upsert({
    where: { code: 'CEO' },
    update: {},
    create: { code: 'CEO', name: '대표이사', level: 1, sortOrder: 1 },
  })
  const posDirector = await prisma.position.upsert({
    where: { code: 'DIR' },
    update: {},
    create: { code: 'DIR', name: '이사', level: 2, sortOrder: 2 },
  })
  const posManager = await prisma.position.upsert({
    where: { code: 'MGR' },
    update: {},
    create: { code: 'MGR', name: '팀장', level: 3, sortOrder: 3 },
  })
  const posSenior = await prisma.position.upsert({
    where: { code: 'SR' },
    update: {},
    create: { code: 'SR', name: '대리', level: 4, sortOrder: 4 },
  })
  const posStaff = await prisma.position.upsert({
    where: { code: 'STF' },
    update: {},
    create: { code: 'STF', name: '사원', level: 5, sortOrder: 5 },
  })
  const posExecVP = await prisma.position.upsert({
    where: { code: 'EVP' },
    update: {},
    create: { code: 'EVP', name: '전무', level: 2, sortOrder: 2 },
  })
  const posSrDir = await prisma.position.upsert({
    where: { code: 'SMU' },
    update: {},
    create: { code: 'SMU', name: '상무', level: 2, sortOrder: 3 },
  })
  const posGM = await prisma.position.upsert({
    where: { code: 'GM' },
    update: {},
    create: { code: 'GM', name: '부장', level: 3, sortOrder: 4 },
  })
  const posDM = await prisma.position.upsert({
    where: { code: 'DM' },
    update: {},
    create: { code: 'DM', name: '차장', level: 4, sortOrder: 5 },
  })
  const posAsstMgr = await prisma.position.upsert({
    where: { code: 'AM' },
    update: {},
    create: { code: 'AM', name: '과장', level: 5, sortOrder: 6 },
  })

  // ============================================================
  // 4. 직원 (Employees)
  // ============================================================
  const empData = [
    {
      no: 'EMP-001',
      name: '김웰그린',
      dept: deptMgmt.id,
      pos: posCEO.id,
      join: '2020-01-02',
      phone: '010-1234-5678',
      email: 'kim@wellgreen.co.kr',
    },
    {
      no: 'EMP-002',
      name: '박영업',
      dept: deptSales.id,
      pos: posManager.id,
      join: '2021-03-15',
      phone: '010-2345-6789',
      email: 'park@wellgreen.co.kr',
    },
    {
      no: 'EMP-003',
      name: '이개발',
      dept: deptDev.id,
      pos: posManager.id,
      join: '2021-06-01',
      phone: '010-3456-7890',
      email: 'lee@wellgreen.co.kr',
    },
    {
      no: 'EMP-004',
      name: '최생산',
      dept: deptProd.id,
      pos: posManager.id,
      join: '2022-01-10',
      phone: '010-4567-8901',
      email: 'choi@wellgreen.co.kr',
    },
    {
      no: 'EMP-005',
      name: '정구매',
      dept: deptPurchase.id,
      pos: posSenior.id,
      join: '2022-05-20',
      phone: '010-5678-9012',
      email: 'jung@wellgreen.co.kr',
    },
    {
      no: 'EMP-006',
      name: '한회계',
      dept: deptAccounting.id,
      pos: posManager.id,
      join: '2021-09-01',
      phone: '010-6789-0123',
      email: 'han@wellgreen.co.kr',
    },
    {
      no: 'EMP-007',
      name: '강사원',
      dept: deptSales.id,
      pos: posStaff.id,
      join: '2023-03-02',
      phone: '010-7890-1234',
      email: 'kang@wellgreen.co.kr',
    },
    {
      no: 'EMP-008',
      name: '윤사원',
      dept: deptDev.id,
      pos: posStaff.id,
      join: '2023-07-15',
      phone: '010-8901-2345',
      email: 'yoon@wellgreen.co.kr',
    },
    {
      no: 'EMP-009',
      name: '임대리',
      dept: deptMgmt.id,
      pos: posSenior.id,
      join: '2022-11-01',
      phone: '010-9012-3456',
      email: 'lim@wellgreen.co.kr',
    },
    {
      no: 'EMP-010',
      name: '조이사',
      dept: deptMgmt.id,
      pos: posDirector.id,
      join: '2020-06-15',
      phone: '010-0123-4567',
      email: 'jo@wellgreen.co.kr',
    },
  ]

  const employees: Record<string, any> = {}
  for (const e of empData) {
    employees[e.no] = await prisma.employee.upsert({
      where: { employeeNo: e.no },
      update: {},
      create: {
        employeeNo: e.no,
        nameKo: e.name,
        departmentId: e.dept,
        positionId: e.pos,
        joinDate: new Date(e.join),
        phone: e.phone,
        email: e.email,
      },
    })
  }

  // ============================================================
  // 5. 사용자 (Users)
  // ============================================================
  const passwordHash = await bcrypt.hash('admin1234', 10)
  const userHash = await bcrypt.hash('user1234', 10)

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: {
      username: 'admin',
      email: 'admin@wellgreen.co.kr',
      passwordHash,
      name: '김웰그린',
      isActive: true,
      employeeId: employees['EMP-001'].id,
    },
  })
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  })

  // 추가 사용자
  const userAccounts = [
    { username: 'parksales', name: '박영업', emp: 'EMP-002', role: managerRole.id },
    { username: 'leedev', name: '이개발', emp: 'EMP-003', role: managerRole.id },
    { username: 'hanacct', name: '한회계', emp: 'EMP-006', role: userRole.id },
    { username: 'kangstaff', name: '강사원', emp: 'EMP-007', role: userRole.id },
  ]
  for (const u of userAccounts) {
    const created = await prisma.user.upsert({
      where: { username: u.username },
      update: { passwordHash: userHash },
      create: {
        username: u.username,
        email: employees[u.emp].email,
        passwordHash: userHash,
        name: u.name,
        isActive: true,
        employeeId: employees[u.emp].id,
      },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: created.id, roleId: u.role } },
      update: {},
      create: { userId: created.id, roleId: u.role },
    })
  }

  console.log('Admin: username=admin, password=admin1234')
  console.log('Users: parksales/leedev/hanacct/kangstaff, password=user1234')

  // ============================================================
  // 6. 계정과목 (Account Subjects)
  // ============================================================
  const accounts = [
    { code: '1010', nameKo: '현금', accountType: 'ASSET' as const, level: 2 },
    { code: '1020', nameKo: '보통예금', accountType: 'ASSET' as const, level: 2 },
    { code: '1100', nameKo: '매출채권', accountType: 'ASSET' as const, level: 2 },
    { code: '1200', nameKo: '재고자산', accountType: 'ASSET' as const, level: 2 },
    { code: '1300', nameKo: '선급금', accountType: 'ASSET' as const, level: 2 },
    { code: '1400', nameKo: '미수금', accountType: 'ASSET' as const, level: 2 },
    { code: '1500', nameKo: '유형자산', accountType: 'ASSET' as const, level: 2 },
    { code: '2100', nameKo: '매입채무', accountType: 'LIABILITY' as const, level: 2 },
    { code: '2200', nameKo: '미지급금', accountType: 'LIABILITY' as const, level: 2 },
    { code: '2300', nameKo: '예수금', accountType: 'LIABILITY' as const, level: 2 },
    { code: '2400', nameKo: '부가세예수금', accountType: 'LIABILITY' as const, level: 2, taxRelated: true },
    { code: '2500', nameKo: '선수금', accountType: 'LIABILITY' as const, level: 2 },
    { code: '3100', nameKo: '자본금', accountType: 'EQUITY' as const, level: 2 },
    { code: '3200', nameKo: '이익잉여금', accountType: 'EQUITY' as const, level: 2 },
    { code: '4100', nameKo: '매출', accountType: 'REVENUE' as const, level: 2 },
    { code: '4200', nameKo: '기타수익', accountType: 'REVENUE' as const, level: 2 },
    { code: '5100', nameKo: '매출원가', accountType: 'EXPENSE' as const, level: 2 },
    { code: '5200', nameKo: '급여', accountType: 'EXPENSE' as const, level: 2 },
    { code: '5300', nameKo: '복리후생비', accountType: 'EXPENSE' as const, level: 2 },
    { code: '5400', nameKo: '임차료', accountType: 'EXPENSE' as const, level: 2 },
    { code: '5500', nameKo: '접대비', accountType: 'EXPENSE' as const, level: 2 },
    { code: '5600', nameKo: '통신비', accountType: 'EXPENSE' as const, level: 2 },
    { code: '5700', nameKo: '소모품비', accountType: 'EXPENSE' as const, level: 2 },
    { code: '5800', nameKo: '감가상각비', accountType: 'EXPENSE' as const, level: 2 },
  ]
  const accMap: Record<string, any> = {}
  for (const acc of accounts) {
    accMap[acc.code] = await prisma.accountSubject.upsert({
      where: { code: acc.code },
      update: {},
      create: acc,
    })
  }

  // ============================================================
  // 7. 회계연도 (Fiscal Year)
  // ============================================================
  const currentYear = new Date().getFullYear()
  const fiscalYear = await prisma.fiscalYear.upsert({
    where: { year: currentYear },
    update: {},
    create: {
      year: currentYear,
      startDate: new Date(`${currentYear}-01-01`),
      endDate: new Date(`${currentYear}-12-31`),
    },
  })

  // ============================================================
  // 8. 거래처 (Partners)
  // ============================================================
  const partnerData = [
    {
      code: 'P-001',
      name: '(주)한국전자',
      type: 'SALES' as const,
      biz: '123-45-67890',
      ceo: '김전자',
      bizType: '제조업',
      bizCat: '전자부품',
      phone: '02-1234-5678',
      email: 'info@hankook-elec.co.kr',
      address: '서울시 강남구 테헤란로 123',
    },
    {
      code: 'P-002',
      name: '삼성산업(주)',
      type: 'SALES' as const,
      biz: '234-56-78901',
      ceo: '이산업',
      bizType: '도소매',
      bizCat: '산업용품',
      phone: '02-2345-6789',
      email: 'sales@samsung-ind.co.kr',
      address: '서울시 서초구 반포대로 45',
    },
    {
      code: 'P-003',
      name: '대한물산',
      type: 'BOTH' as const,
      biz: '345-67-89012',
      ceo: '박물산',
      bizType: '도소매',
      bizCat: '종합물류',
      phone: '031-345-6789',
      email: 'contact@daehan.co.kr',
      address: '경기도 성남시 분당구 판교로 67',
    },
    {
      code: 'P-004',
      name: '글로벌테크',
      type: 'PURCHASE' as const,
      biz: '456-78-90123',
      ceo: '최테크',
      bizType: '제조업',
      bizCat: 'IT장비',
      phone: '02-4567-8901',
      email: 'order@globaltech.co.kr',
      address: '서울시 마포구 월드컵북로 89',
    },
    {
      code: 'P-005',
      name: '(주)우리소재',
      type: 'PURCHASE' as const,
      biz: '567-89-01234',
      ceo: '정소재',
      bizType: '제조업',
      bizCat: '원자재',
      phone: '032-567-8901',
      email: 'supply@woori-mat.co.kr',
      address: '인천시 남동구 남동대로 234',
    },
    {
      code: 'P-006',
      name: '미래유통',
      type: 'SALES' as const,
      biz: '678-90-12345',
      ceo: '한유통',
      bizType: '도소매',
      bizCat: '유통',
      phone: '02-6789-0123',
      email: 'biz@mirae-dist.co.kr',
      address: '서울시 송파구 올림픽로 345',
    },
    {
      code: 'P-007',
      name: '테크솔루션(주)',
      type: 'BOTH' as const,
      biz: '789-01-23456',
      ceo: '강솔루',
      bizType: '서비스업',
      bizCat: 'IT서비스',
      phone: '02-7890-1234',
      email: 'info@techsol.co.kr',
      address: '서울시 영등포구 여의대로 56',
    },
    {
      code: 'P-008',
      name: '한빛에너지',
      type: 'PURCHASE' as const,
      biz: '890-12-34567',
      ceo: '윤에너',
      bizType: '제조업',
      bizCat: '에너지',
      phone: '044-890-1234',
      email: 'power@hanbit-energy.co.kr',
      address: '세종시 한누리대로 78',
    },
  ]

  const partners: Record<string, any> = {}
  for (const p of partnerData) {
    partners[p.code] = await prisma.partner.upsert({
      where: { partnerCode: p.code },
      update: {},
      create: {
        partnerCode: p.code,
        partnerName: p.name,
        partnerType: p.type,
        bizNo: p.biz,
        ceoName: p.ceo,
        bizType: p.bizType,
        bizCategory: p.bizCat,
        phone: p.phone,
        email: p.email,
        address: p.address,
      },
    })
  }

  // ============================================================
  // 9. 품목 카테고리 & 품목 (Items)
  // ============================================================
  const catElec = await prisma.itemCategory.upsert({
    where: { code: 'CAT-01' },
    update: {},
    create: { code: 'CAT-01', name: '전자부품', level: 1 },
  })
  const catMat = await prisma.itemCategory.upsert({
    where: { code: 'CAT-02' },
    update: {},
    create: { code: 'CAT-02', name: '원자재', level: 1 },
  })
  const catProd = await prisma.itemCategory.upsert({
    where: { code: 'CAT-03' },
    update: {},
    create: { code: 'CAT-03', name: '완제품', level: 1 },
  })
  const catOffice = await prisma.itemCategory.upsert({
    where: { code: 'CAT-04' },
    update: {},
    create: { code: 'CAT-04', name: '사무용품', level: 1 },
  })

  const itemData = [
    {
      code: 'ITM-001',
      name: 'LED 디스플레이 모듈',
      cat: catElec.id,
      unit: 'EA',
      price: 150000,
      type: 'PRODUCT' as const,
      spec: '24인치 FHD',
      safety: 50,
    },
    {
      code: 'ITM-002',
      name: '전원공급장치 500W',
      cat: catElec.id,
      unit: 'EA',
      price: 85000,
      type: 'PRODUCT' as const,
      spec: 'ATX 500W 80+',
      safety: 100,
    },
    {
      code: 'ITM-003',
      name: 'PCB 기판 A타입',
      cat: catMat.id,
      unit: 'EA',
      price: 12000,
      type: 'RAW_MATERIAL' as const,
      spec: '150x100mm',
      safety: 200,
    },
    {
      code: 'ITM-004',
      name: '알루미늄 방열판',
      cat: catMat.id,
      unit: 'EA',
      price: 8500,
      type: 'RAW_MATERIAL' as const,
      spec: '100x80x30mm',
      safety: 300,
    },
    {
      code: 'ITM-005',
      name: '스마트 컨트롤러 V2',
      cat: catProd.id,
      unit: 'SET',
      price: 320000,
      type: 'PRODUCT' as const,
      spec: 'IoT 지원',
      safety: 30,
    },
    {
      code: 'ITM-006',
      name: 'USB-C 케이블',
      cat: catElec.id,
      unit: 'EA',
      price: 5500,
      type: 'GOODS' as const,
      spec: '1.5m',
      safety: 500,
    },
    {
      code: 'ITM-007',
      name: '센서 모듈 SEN-100',
      cat: catElec.id,
      unit: 'EA',
      price: 45000,
      type: 'PRODUCT' as const,
      spec: '온도/습도',
      safety: 80,
    },
    {
      code: 'ITM-008',
      name: '스테인리스 볼트 세트',
      cat: catMat.id,
      unit: 'BOX',
      price: 25000,
      type: 'SUBSIDIARY' as const,
      spec: 'M4/M5/M6 혼합',
      safety: 50,
    },
    {
      code: 'ITM-009',
      name: 'A4 복사용지',
      cat: catOffice.id,
      unit: 'BOX',
      price: 28000,
      type: 'SUBSIDIARY' as const,
      spec: '80g 2500매',
      safety: 20,
    },
    {
      code: 'ITM-010',
      name: '산업용 모니터 15인치',
      cat: catProd.id,
      unit: 'EA',
      price: 480000,
      type: 'PRODUCT' as const,
      spec: '방수/방진 IP65',
      safety: 15,
    },
  ]

  const items: Record<string, any> = {}
  for (const i of itemData) {
    items[i.code] = await prisma.item.upsert({
      where: { itemCode: i.code },
      update: {},
      create: {
        itemCode: i.code,
        itemName: i.name,
        categoryId: i.cat,
        unit: i.unit,
        standardPrice: i.price,
        itemType: i.type,
        specification: i.spec,
        safetyStock: i.safety,
      },
    })
  }

  // ============================================================
  // 10. 창고 (Warehouses)
  // ============================================================
  const wh1 = await prisma.warehouse.upsert({
    where: { code: 'WH-01' },
    update: {},
    create: { code: 'WH-01', name: '본사 창고', location: '서울시 강남구' },
  })
  const wh2 = await prisma.warehouse.upsert({
    where: { code: 'WH-02' },
    update: {},
    create: { code: 'WH-02', name: '판교 물류센터', location: '경기도 성남시 분당구' },
  })
  const wh3 = await prisma.warehouse.upsert({
    where: { code: 'WH-03' },
    update: {},
    create: { code: 'WH-03', name: '인천 자재창고', location: '인천시 남동구' },
  })

  // 창고 구역
  for (const wh of [wh1, wh2, wh3]) {
    for (const zone of [
      { code: 'A', name: 'A구역 - 완제품' },
      { code: 'B', name: 'B구역 - 원자재' },
      { code: 'C', name: 'C구역 - 부자재' },
    ]) {
      await prisma.warehouseZone.upsert({
        where: { warehouseId_zoneCode: { warehouseId: wh.id, zoneCode: zone.code } },
        update: {},
        create: { warehouseId: wh.id, zoneCode: zone.code, zoneName: zone.name },
      })
    }
  }

  // 재고 잔량 (Stock Balance)
  const stockData = [
    { item: 'ITM-001', wh: wh1.id, qty: 120 },
    { item: 'ITM-002', wh: wh1.id, qty: 250 },
    { item: 'ITM-003', wh: wh3.id, qty: 500 },
    { item: 'ITM-004', wh: wh3.id, qty: 800 },
    { item: 'ITM-005', wh: wh1.id, qty: 45 },
    { item: 'ITM-006', wh: wh2.id, qty: 1200 },
    { item: 'ITM-007', wh: wh1.id, qty: 150 },
    { item: 'ITM-008', wh: wh3.id, qty: 75 },
    { item: 'ITM-009', wh: wh1.id, qty: 30 },
    { item: 'ITM-010', wh: wh2.id, qty: 25 },
  ]
  for (const s of stockData) {
    const item = items[s.item]
    await prisma.stockBalance
      .upsert({
        where: { itemId_warehouseId_zoneId: { itemId: item.id, warehouseId: s.wh, zoneId: null as any } },
        update: { quantity: s.qty },
        create: { itemId: item.id, warehouseId: s.wh, quantity: s.qty, averageCost: item.standardPrice },
      })
      .catch(() => {
        // unique constraint workaround for null zoneId
        return prisma.stockBalance
          .create({
            data: { itemId: item.id, warehouseId: s.wh, quantity: s.qty, averageCost: item.standardPrice },
          })
          .catch(() => {})
      })
  }

  // ============================================================
  // 11. 견적서 (Quotations)
  // ============================================================
  const qt1 = await prisma.quotation.upsert({
    where: { quotationNo: 'QT-2026-0001' },
    update: {},
    create: {
      quotationNo: 'QT-2026-0001',
      quotationDate: new Date('2026-01-15'),
      partnerId: partners['P-001'].id,
      employeeId: employees['EMP-002'].id,
      validUntil: new Date('2026-02-15'),
      status: 'ORDERED',
      totalSupply: 3200000,
      totalTax: 320000,
      totalAmount: 3520000,
      description: 'LED 디스플레이 모듈 공급 견적',
    },
  })
  await prisma.quotationDetail.createMany({
    data: [
      {
        quotationId: qt1.id,
        lineNo: 1,
        itemId: items['ITM-001'].id,
        quantity: 20,
        unitPrice: 150000,
        supplyAmount: 3000000,
        taxAmount: 300000,
        totalAmount: 3300000,
      },
      {
        quotationId: qt1.id,
        lineNo: 2,
        itemId: items['ITM-006'].id,
        quantity: 40,
        unitPrice: 5000,
        supplyAmount: 200000,
        taxAmount: 20000,
        totalAmount: 220000,
      },
    ],
    skipDuplicates: true,
  })

  const qt2 = await prisma.quotation.upsert({
    where: { quotationNo: 'QT-2026-0002' },
    update: {},
    create: {
      quotationNo: 'QT-2026-0002',
      quotationDate: new Date('2026-01-20'),
      partnerId: partners['P-002'].id,
      employeeId: employees['EMP-002'].id,
      validUntil: new Date('2026-02-20'),
      status: 'SUBMITTED',
      totalSupply: 4800000,
      totalTax: 480000,
      totalAmount: 5280000,
      description: '스마트 컨트롤러 납품 견적',
    },
  })
  await prisma.quotationDetail.createMany({
    data: [
      {
        quotationId: qt2.id,
        lineNo: 1,
        itemId: items['ITM-005'].id,
        quantity: 15,
        unitPrice: 320000,
        supplyAmount: 4800000,
        taxAmount: 480000,
        totalAmount: 5280000,
      },
    ],
    skipDuplicates: true,
  })

  // ============================================================
  // 12. 발주 (Sales Orders)
  // ============================================================
  const so1 = await prisma.salesOrder.upsert({
    where: { orderNo: 'SO-2026-0001' },
    update: {},
    create: {
      orderNo: 'SO-2026-0001',
      orderDate: new Date('2026-01-20'),
      partnerId: partners['P-001'].id,
      quotationId: qt1.id,
      employeeId: employees['EMP-002'].id,
      deliveryDate: new Date('2026-02-10'),
      totalSupply: 3200000,
      totalTax: 320000,
      totalAmount: 3520000,
      status: 'COMPLETED',
      description: 'LED 디스플레이 모듈 수주',
    },
  })
  await prisma.salesOrderDetail.createMany({
    data: [
      {
        salesOrderId: so1.id,
        lineNo: 1,
        itemId: items['ITM-001'].id,
        quantity: 20,
        unitPrice: 150000,
        supplyAmount: 3000000,
        taxAmount: 300000,
        totalAmount: 3300000,
        deliveredQty: 20,
        remainingQty: 0,
      },
      {
        salesOrderId: so1.id,
        lineNo: 2,
        itemId: items['ITM-006'].id,
        quantity: 40,
        unitPrice: 5000,
        supplyAmount: 200000,
        taxAmount: 20000,
        totalAmount: 220000,
        deliveredQty: 40,
        remainingQty: 0,
      },
    ],
    skipDuplicates: true,
  })

  const so2 = await prisma.salesOrder.upsert({
    where: { orderNo: 'SO-2026-0002' },
    update: {},
    create: {
      orderNo: 'SO-2026-0002',
      orderDate: new Date('2026-02-01'),
      partnerId: partners['P-003'].id,
      employeeId: employees['EMP-007'].id,
      deliveryDate: new Date('2026-02-28'),
      totalSupply: 2250000,
      totalTax: 225000,
      totalAmount: 2475000,
      status: 'IN_PROGRESS',
      description: '센서 모듈 주문',
    },
  })
  await prisma.salesOrderDetail.createMany({
    data: [
      {
        salesOrderId: so2.id,
        lineNo: 1,
        itemId: items['ITM-007'].id,
        quantity: 50,
        unitPrice: 45000,
        supplyAmount: 2250000,
        taxAmount: 225000,
        totalAmount: 2475000,
        deliveredQty: 20,
        remainingQty: 30,
      },
    ],
    skipDuplicates: true,
  })

  const so3 = await prisma.salesOrder.upsert({
    where: { orderNo: 'SO-2026-0003' },
    update: {},
    create: {
      orderNo: 'SO-2026-0003',
      orderDate: new Date('2026-02-10'),
      partnerId: partners['P-006'].id,
      employeeId: employees['EMP-002'].id,
      deliveryDate: new Date('2026-03-15'),
      totalSupply: 9600000,
      totalTax: 960000,
      totalAmount: 10560000,
      status: 'ORDERED',
      description: '산업용 모니터 대량 주문',
    },
  })
  await prisma.salesOrderDetail.createMany({
    data: [
      {
        salesOrderId: so3.id,
        lineNo: 1,
        itemId: items['ITM-010'].id,
        quantity: 20,
        unitPrice: 480000,
        supplyAmount: 9600000,
        taxAmount: 960000,
        totalAmount: 10560000,
        deliveredQty: 0,
        remainingQty: 20,
      },
    ],
    skipDuplicates: true,
  })

  // ============================================================
  // 13. 전표 (Vouchers)
  // ============================================================
  const v1 = await prisma.voucher.create({
    data: {
      voucherNo: 'V-2026-0001',
      voucherDate: new Date('2026-01-31'),
      voucherType: 'SALES',
      description: '1월 매출 전표',
      totalDebit: 3520000,
      totalCredit: 3520000,
      status: 'APPROVED',
      fiscalYearId: fiscalYear.id,
      createdById: employees['EMP-006'].id,
      approvedById: employees['EMP-001'].id,
      details: {
        create: [
          {
            lineNo: 1,
            accountSubjectId: accMap['1100'].id,
            debitAmount: 3520000,
            creditAmount: 0,
            partnerId: partners['P-001'].id,
            description: '한국전자 매출채권',
          },
          {
            lineNo: 2,
            accountSubjectId: accMap['4100'].id,
            debitAmount: 0,
            creditAmount: 3200000,
            description: '매출',
          },
          {
            lineNo: 3,
            accountSubjectId: accMap['2400'].id,
            debitAmount: 0,
            creditAmount: 320000,
            description: '부가세',
          },
        ],
      },
    },
  })

  await prisma.voucher.create({
    data: {
      voucherNo: 'V-2026-0002',
      voucherDate: new Date('2026-02-05'),
      voucherType: 'RECEIPT',
      description: '한국전자 매출대금 수금',
      totalDebit: 3520000,
      totalCredit: 3520000,
      status: 'APPROVED',
      fiscalYearId: fiscalYear.id,
      createdById: employees['EMP-006'].id,
      approvedById: employees['EMP-001'].id,
      details: {
        create: [
          {
            lineNo: 1,
            accountSubjectId: accMap['1020'].id,
            debitAmount: 3520000,
            creditAmount: 0,
            description: '보통예금 입금',
          },
          {
            lineNo: 2,
            accountSubjectId: accMap['1100'].id,
            debitAmount: 0,
            creditAmount: 3520000,
            partnerId: partners['P-001'].id,
            description: '매출채권 회수',
          },
        ],
      },
    },
  })

  await prisma.voucher.create({
    data: {
      voucherNo: 'V-2026-0003',
      voucherDate: new Date('2026-02-10'),
      voucherType: 'PAYMENT',
      description: '2월 급여 지급',
      totalDebit: 15000000,
      totalCredit: 15000000,
      status: 'APPROVED',
      fiscalYearId: fiscalYear.id,
      createdById: employees['EMP-006'].id,
      approvedById: employees['EMP-001'].id,
      details: {
        create: [
          {
            lineNo: 1,
            accountSubjectId: accMap['5200'].id,
            debitAmount: 15000000,
            creditAmount: 0,
            description: '급여',
          },
          {
            lineNo: 2,
            accountSubjectId: accMap['1020'].id,
            debitAmount: 0,
            creditAmount: 15000000,
            description: '보통예금 출금',
          },
        ],
      },
    },
  })

  // ============================================================
  // 14. 게시판 (Boards & Posts)
  // ============================================================
  const boardNotice = await prisma.board.upsert({
    where: { boardCode: 'NOTICE' },
    update: {},
    create: { boardCode: 'NOTICE', boardName: '공지사항', boardType: 'NOTICE' },
  })
  const boardGeneral = await prisma.board.upsert({
    where: { boardCode: 'GENERAL' },
    update: {},
    create: { boardCode: 'GENERAL', boardName: '자유게시판', boardType: 'GENERAL' },
  })

  await prisma.post.createMany({
    data: [
      {
        boardId: boardNotice.id,
        title: '2026년 상반기 경영계획 안내',
        content:
          '안녕하세요, 2026년 상반기 경영계획을 공유드립니다.\n\n1. 매출 목표: 50억원\n2. 신규 거래처 확보: 20개사\n3. 신제품 출시: 3종\n\n자세한 내용은 첨부파일을 참고해주세요.',
        authorId: adminUser.id,
        isPinned: true,
        viewCount: 45,
      },
      {
        boardId: boardNotice.id,
        title: '사내 보안 정책 변경 안내',
        content:
          '2월부터 사내 보안 정책이 변경됩니다.\n\n- USB 사용 제한\n- 비밀번호 90일마다 변경 필수\n- 2차 인증 도입\n\n협조 부탁드립니다.',
        authorId: adminUser.id,
        isPinned: true,
        viewCount: 38,
      },
      {
        boardId: boardNotice.id,
        title: 'ERP 시스템 점검 안내 (2/20)',
        content: '2월 20일 오후 6시~8시 ERP 시스템 점검이 진행됩니다.\n해당 시간에는 시스템 이용이 제한될 수 있습니다.',
        authorId: adminUser.id,
        viewCount: 22,
      },
      {
        boardId: boardGeneral.id,
        title: '점심 맛집 추천합니다',
        content: '회사 근처 새로 생긴 일식집 추천드립니다.\n런치 메뉴가 가성비 좋아요!',
        authorId: adminUser.id,
        viewCount: 15,
      },
      {
        boardId: boardGeneral.id,
        title: '이번 주 금요일 회식 참석 여부',
        content: '이번 주 금요일 팀 회식이 있습니다.\n참석 가능하신 분들은 댓글 남겨주세요.',
        authorId: adminUser.id,
        viewCount: 28,
      },
    ],
    skipDuplicates: true,
  })

  // ============================================================
  // 15. 출퇴근 기록 (Attendance) - 최근 5일
  // ============================================================
  const today = new Date()
  for (let d = 1; d <= 5; d++) {
    const workDate = new Date(today)
    workDate.setDate(today.getDate() - d)
    if (workDate.getDay() === 0 || workDate.getDay() === 6) continue

    for (const empNo of ['EMP-001', 'EMP-002', 'EMP-003', 'EMP-006', 'EMP-007']) {
      const checkIn = new Date(workDate)
      checkIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0)
      const checkOut = new Date(workDate)
      checkOut.setHours(17 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0)
      const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)

      await prisma.attendance
        .create({
          data: {
            employeeId: employees[empNo].id,
            workDate,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            workHours: Math.round(hours * 100) / 100,
            overtimeHours: Math.max(0, Math.round((hours - 8) * 100) / 100),
            attendanceType: checkIn.getHours() >= 9 && checkIn.getMinutes() > 30 ? 'LATE' : 'NORMAL',
          },
        })
        .catch(() => {})
    }
  }

  // ============================================================
  // 16. 휴가 잔여 (Leave Balance)
  // ============================================================
  for (const empNo of Object.keys(employees)) {
    await prisma.leaveBalance.upsert({
      where: { employeeId_year: { employeeId: employees[empNo].id, year: currentYear } },
      update: {},
      create: {
        employeeId: employees[empNo].id,
        year: currentYear,
        totalDays: 15,
        usedDays: Math.floor(Math.random() * 5),
        remainingDays: 15 - Math.floor(Math.random() * 5),
      },
    })
  }

  console.log('Seed completed!')
  console.log('Created: 6 departments, 10 positions, 10 employees, 5 users')
  console.log('Created: 8 partners, 10 items, 3 warehouses')
  console.log('Created: 2 quotations, 3 sales orders, 3 vouchers')
  console.log('Created: 2 boards with 5 posts, attendance records, leave balances')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

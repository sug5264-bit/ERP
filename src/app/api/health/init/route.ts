import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

/**
 * POST /api/health/init
 * 프로덕션에서 admin 계정이 없을 경우 초기 계정을 생성합니다.
 * 이미 admin 계정이 존재하면 아무 작업도 하지 않습니다.
 */
export async function POST() {
  try {
    // DB 연결 테스트
    await prisma.$queryRawUnsafe('SELECT 1')

    // admin 사용자 존재 여부 확인
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true },
    })

    if (existingAdmin) {
      return NextResponse.json({ message: 'admin 계정이 이미 존재합니다.', created: false })
    }

    // Role 생성
    const adminRole = await prisma.role.upsert({
      where: { name: '관리자' },
      update: {},
      create: { name: '관리자', description: '시스템 관리자', isSystem: true },
    })

    // admin 계정 생성
    const passwordHash = await hash('admin1234', 10)
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@wellgreen.co.kr',
        passwordHash,
        name: '관리자',
        isActive: true,
      },
    })

    await prisma.userRole.create({
      data: { userId: admin.id, roleId: adminRole.id },
    })

    return NextResponse.json({
      message: 'admin 계정이 생성되었습니다. (ID: admin / PW: admin1234)',
      created: true,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

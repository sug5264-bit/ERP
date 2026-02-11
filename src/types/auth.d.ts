import 'next-auth'

interface UserPermission {
  module: string
  action: string
}

declare module 'next-auth' {
  interface User {
    id: string
    roles: string[]
    permissions: UserPermission[]
    employeeId: string | null
    employeeName: string | null
    departmentName: string | null
    positionName: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      roles: string[]
      permissions: UserPermission[]
      employeeId: string | null
      employeeName: string | null
      departmentName: string | null
      positionName: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    roles: string[]
    permissions: UserPermission[]
    employeeId: string | null
    employeeName: string | null
    departmentName: string | null
    positionName: string | null
  }
}

import { ORG_AG, ORG_DT, ORG_MK, ORG_NAME } from './orgIds.js'

export const DEMO_PASSWORD = '123456@'

export const ORGANIZATIONS = [
  {
    id: ORG_AG,
    name: ORG_NAME[ORG_AG],
    fieldCount: 18,
    unreadAlerts: 4,
    unreadNotifications: 7,
  },
  {
    id: ORG_MK,
    name: ORG_NAME[ORG_MK],
    fieldCount: 42,
    unreadAlerts: 2,
    unreadNotifications: 3,
  },
  {
    id: ORG_DT,
    name: ORG_NAME[ORG_DT],
    fieldCount: 11,
    unreadAlerts: 6,
    unreadNotifications: 5,
  },
]

export const USERS = [
  {
    id: 'usr_admin',
    fullName: 'Nguyễn Minh Trí',
    email: 'admin@riceguardian.vn',
    phone: '0901000001',
    role: 'admin',
    password: DEMO_PASSWORD,
    organizationIds: [],
  },
  {
    id: 'usr_manager',
    fullName: 'Trần Thị Hồng',
    email: 'manager@gmail.vn',
    phone: '0901000002',
    role: 'manager',
    password: DEMO_PASSWORD,
    organizationIds: [ORG_MK],
  },
  {
    id: 'usr_ktv',
    fullName: 'Lê Văn Khoa',
    email: 'ktv@gmail.vn',
    phone: '0901000003',
    role: 'technician',
    password: DEMO_PASSWORD,
    organizationIds: [ORG_AG, ORG_DT],
  },
]

export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Quản lý doanh nghiệp/HTX',
  technician: 'Kỹ thuật viên nông nghiệp',
}

export const FIELDS = [
  {
    id: 'fld_ag_01',
    name: 'Thửa A1 — kênh 7',
    orgId: ORG_AG,
    areaHa: 1.6,
    variety: 'OM 18',
    riskLevel: 'high',
    riskType: 'environment',
  },
  {
    id: 'fld_dt_02',
    name: 'Thửa P3 — bờ tây',
    orgId: ORG_DT,
    areaHa: 2.1,
    variety: 'Đài Thơm 8',
    riskLevel: 'high',
    riskType: 'image',
  },
  {
    id: 'fld_ag_04',
    name: 'Thửa A4 — đầu kênh',
    orgId: ORG_AG,
    areaHa: 0.9,
    variety: 'ST25',
    riskLevel: 'medium',
    riskType: 'environment',
  },
  {
    id: 'fld_dt_01',
    name: 'Thửa P1 — giồng cát',
    orgId: ORG_DT,
    areaHa: 1.2,
    variety: 'OM 5451',
    riskLevel: 'medium',
    riskType: 'image',
  },
  {
    id: 'fld_ag_08',
    name: 'Thửa A8 — cuối bờ',
    orgId: ORG_AG,
    areaHa: 1.4,
    variety: 'OM 18',
    riskLevel: 'low',
    riskType: 'environment',
  },
  {
    id: 'fld_mk_12',
    name: 'Thửa M12 — cụm 2',
    orgId: ORG_MK,
    areaHa: 3.4,
    variety: 'IR 50404',
    riskLevel: 'medium',
    riskType: 'environment',
  },
  {
    id: 'fld_mk_03',
    name: 'Thửa M3 — bờ đông',
    orgId: ORG_MK,
    areaHa: 2.2,
    variety: 'OM 18',
    riskLevel: 'low',
    riskType: 'environment',
  },
]

export function orgsForUser(user) {
  return ORGANIZATIONS.filter((org) => user.organizationIds.includes(org.id))
}

export function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    organizationIds: user.organizationIds,
  }
}

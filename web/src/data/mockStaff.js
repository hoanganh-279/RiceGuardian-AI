import { ORG_AG, ORG_DT, ORG_MK } from './orgIds.js'

export const SEASONS = [
  { id: 'ssn_2026_hethu', name: 'Hè Thu 2026', start: '2026-04-01', end: '2026-08-31' },
  { id: 'ssn_2026_dongxuan', name: 'Đông Xuân 2025–2026', start: '2025-12-01', end: '2026-03-31' },
]

export const TECHNICIANS = [
  {
    id: 'usr_ktv',
    fullName: 'Lê Văn Khoa',
    phone: '0901000003',
    email: 'ktv@gmail.vn',
    orgIds: [ORG_AG, ORG_DT],
    region: 'Kênh 7 + bờ tây',
  },
  {
    id: 'usr_ktv_mk',
    fullName: 'Đặng Quốc Huy',
    phone: '0901000004',
    email: 'huy.ktv@gmail.vn',
    orgIds: [ORG_MK],
    region: 'Cụm 2 Mekong',
  },
  {
    id: 'usr_ktv_mk2',
    fullName: 'Phan Thị Mai',
    phone: '0901000005',
    email: 'mai.ktv@gmail.vn',
    orgIds: [ORG_MK],
    region: 'Bờ đông',
  },
]

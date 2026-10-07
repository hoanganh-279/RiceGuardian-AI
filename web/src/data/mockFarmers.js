import { ORG_AG, ORG_DT, ORG_MK } from './orgIds.js'

export const FARMERS = [
  {
    id: 'frm_ag_01',
    orgId: ORG_AG,
    fullName: 'Nguyễn Thị Út',
    phone: '0902000101',
    fieldIds: ['fld_ag_01'],
    fieldNames: ['Thửa A1 — kênh 7'],
    appAccount: true,
  },
  {
    id: 'frm_dt_01',
    orgId: ORG_DT,
    fullName: 'Phạm Văn Đạt',
    phone: '0902000202',
    fieldIds: ['fld_dt_02'],
    fieldNames: ['Thửa P3 — bờ tây'],
    appAccount: true,
  },
  {
    id: 'frm_dt_02',
    orgId: ORG_DT,
    fullName: 'Lê Minh Tâm',
    phone: '0902000203',
    fieldIds: ['fld_dt_01'],
    fieldNames: ['Thửa P1 — giồng cát'],
    appAccount: false,
  },
  {
    id: 'frm_mk_01',
    orgId: ORG_MK,
    fullName: 'Trần Văn Hùng',
    phone: '0902000301',
    fieldIds: ['fld_mk_12'],
    fieldNames: ['Thửa M12 — cụm 2'],
    appAccount: true,
  },
  {
    id: 'frm_mk_02',
    orgId: ORG_MK,
    fullName: 'Võ Thị Lan',
    phone: '0902000302',
    fieldIds: ['fld_mk_03'],
    fieldNames: ['Thửa M3 — bờ đông'],
    appAccount: false,
  },
]

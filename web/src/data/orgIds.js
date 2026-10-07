/** Canonical org UUIDs — must match packages/rg_core/core/services/seed.py */

export const ORG_AG = '11111111-1111-4111-8111-111111111001'
export const ORG_MK = '11111111-1111-4111-8111-111111111002'
export const ORG_DT = '11111111-1111-4111-8111-111111111003'

export const ORG_NAME = {
  [ORG_AG]: 'HTX Lúa Vàng An Giang',
  [ORG_MK]: 'Doanh nghiệp Gạo Mekong',
  [ORG_DT]: 'HTX Phước Thành Đồng Tháp',
}

export const NAME_TO_ORG_ID = Object.fromEntries(
  Object.entries(ORG_NAME).map(([id, name]) => [name, id]),
)

export const LEGACY_ORG_IDS = {
  org_ag: ORG_AG,
  org_mk: ORG_MK,
  org_dt: ORG_DT,
}

export function withOrgName(row) {
  return { ...row, orgName: ORG_NAME[row.orgId] || '' }
}

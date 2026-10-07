import { ORG_AG, ORG_DT, ORG_MK } from './orgIds.js'

export const FIELD_LOGS = [
  {
    id: 'log_ag_01',
    orgId: ORG_AG,
    fieldId: 'fld_ag_01',
    fieldName: 'Thửa A1 — kênh 7',
    type: 'fertilizer',
    title: 'Bón thúc đẻ nhánh',
    note: 'Urê 40 kg/ha.',
    loggedAt: '2026-08-10T07:00:00+07:00',
  },
  {
    id: 'log_dt_01',
    orgId: ORG_DT,
    fieldId: 'fld_dt_02',
    fieldName: 'Thửa P3 — bờ tây',
    type: 'pesticide',
    title: 'Phun phòng bạc lá',
    note: 'Kasugamycin, sáng sớm.',
    loggedAt: '2026-08-14T06:15:00+07:00',
  },
  {
    id: 'log_mk_01',
    orgId: ORG_MK,
    fieldId: 'fld_mk_12',
    fieldName: 'Thửa M12 — cụm 2',
    type: 'irrigation',
    title: 'Giữ mực nước trỗ',
    note: 'Mực nước 7–8 cm.',
    loggedAt: '2026-08-16T16:40:00+07:00',
  },
  {
    id: 'log_ag_02',
    orgId: ORG_AG,
    fieldId: 'fld_ag_08',
    fieldName: 'Thửa A8 — cuối bờ',
    type: 'sowing',
    title: 'Sạ hàng OM 18',
    note: 'Mật độ 80 kg/ha.',
    loggedAt: '2026-06-22T06:30:00+07:00',
  },
]

export const LOG_TYPE_LABEL = {
  sowing: 'Gieo sạ',
  fertilizer: 'Phân bón',
  pesticide: 'Thuốc BVTV',
  irrigation: 'Tưới / mực nước',
  harvest: 'Thu hoạch',
}

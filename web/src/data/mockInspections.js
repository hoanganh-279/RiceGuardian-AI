import { ORG_AG, ORG_DT, ORG_MK } from './orgIds.js'

export const INSPECTIONS = [
  {
    id: 'ins_ag_01',
    orgId: ORG_AG,
    fieldId: 'fld_ag_01',
    fieldName: 'Thửa A1 — kênh 7',
    scheduledAt: '2026-08-18T15:00:00+07:00',
    status: 'open',
    alertId: 'alrt_ag_01',
    note: 'Kiểm tra ẩm lá và triệu chứng đạo ôn.',
  },
  {
    id: 'ins_dt_01',
    orgId: ORG_DT,
    fieldId: 'fld_dt_02',
    fieldName: 'Thửa P3 — bờ tây',
    scheduledAt: '2026-08-19T07:30:00+07:00',
    status: 'open',
    alertId: 'alrt_dt_01',
    note: 'Đối chiếu ảnh bạc lá với hiện trường.',
  },
  {
    id: 'ins_ag_02',
    orgId: ORG_AG,
    fieldId: 'fld_ag_01',
    fieldName: 'Thửa A1 — kênh 7',
    scheduledAt: '2026-08-19T16:00:00+07:00',
    status: 'open',
    alertId: 'alrt_ag_05',
    note: 'Kiểm tra ẩm lá đạo ôn sau cảnh báo sáng nay.',
  },
  {
    id: 'ins_mk_01',
    orgId: ORG_MK,
    fieldId: 'fld_mk_12',
    fieldName: 'Thửa M12 — cụm 2',
    scheduledAt: '2026-08-17T09:00:00+07:00',
    status: 'done',
    alertId: 'alrt_mk_02',
    note: 'Đã lấy mẫu cổ bông.',
  },
]

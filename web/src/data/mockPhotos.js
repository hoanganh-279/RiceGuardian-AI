import { ORG_AG, ORG_DT, ORG_MK } from './orgIds.js'

const RICE_IMG =
  'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80'
const LEAF_IMG =
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80'
const FIELD_IMG =
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
const PANICLE_IMG =
  'https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?auto=format&fit=crop&w=800&q=80'

export const PHOTOS = [
  {
    id: 'ph_dt_01',
    orgId: ORG_DT,
    fieldId: 'fld_dt_02',
    fieldName: 'Thửa P3 — bờ tây',
    farmerName: 'Phạm Văn Đạt',
    capturedAt: '2026-08-18T06:42:00+07:00',
    lat: 10.512,
    lng: 105.631,
    disease: 'Bạc lá',
    confidence: 0.86,
    reviewed: false,
    alertId: 'alrt_dt_01',
    imageUrl: RICE_IMG,
    rescanDisease: '',
    rescanClass: '',
    rescanConfidence: null,
    rescanAt: null,
  },
  {
    id: 'ph_ag_04',
    orgId: ORG_AG,
    fieldId: 'fld_ag_01',
    fieldName: 'Thửa A1 — kênh 7',
    farmerName: 'Nguyễn Thị Út',
    capturedAt: '2026-08-16T18:12:00+07:00',
    lat: 10.389,
    lng: 105.432,
    disease: 'Đốm nâu',
    confidence: 0.72,
    reviewed: false,
    alertId: 'alrt_ag_04',
    imageUrl: LEAF_IMG,
    rescanDisease: '',
    rescanClass: '',
    rescanConfidence: null,
    rescanAt: null,
  },
  {
    id: 'ph_dt_04',
    orgId: ORG_DT,
    fieldId: 'fld_dt_01',
    fieldName: 'Thửa P1 — giồng cát',
    farmerName: 'Lê Minh Tâm',
    capturedAt: '2026-08-15T11:48:00+07:00',
    lat: 10.498,
    lng: 105.612,
    disease: 'Đạo ôn lá',
    confidence: 0.41,
    reviewed: true,
    alertId: 'alrt_dt_04',
    imageUrl: FIELD_IMG,
    rescanDisease: 'Đốm nâu',
    rescanClass: 'Rice__BrownSpot',
    rescanConfidence: 0.68,
    rescanAt: '2026-08-15T12:10:00+07:00',
  },
  {
    id: 'ph_mk_01',
    orgId: ORG_MK,
    fieldId: 'fld_mk_12',
    fieldName: 'Thửa M12 — cụm 2',
    farmerName: 'Trần Văn Hùng',
    capturedAt: '2026-08-17T13:50:00+07:00',
    lat: 10.045,
    lng: 105.778,
    disease: 'Đạo ôn cổ bông',
    confidence: 0.79,
    reviewed: false,
    alertId: 'alrt_mk_02',
    imageUrl: PANICLE_IMG,
    rescanDisease: '',
    rescanClass: '',
    rescanConfidence: null,
    rescanAt: null,
  },
]

import { ORG_AG, ORG_DT, ORG_MK } from './orgIds.js'

export const STATIONS = [
  {
    id: 'st_ag_04',
    code: 'AG-04',
    name: 'Trạm đầu kênh',
    orgId: ORG_AG,
    fieldId: 'fld_ag_04',
    fieldName: 'Thửa A4 — đầu kênh',
    online: true,
    batteryPct: 72,
    lastSeenAt: '2026-08-18T10:42:00+07:00',
    issue: null,
  },
  {
    id: 'st_ag_01',
    code: 'AG-01',
    name: 'Trạm kênh 7',
    orgId: ORG_AG,
    fieldId: 'fld_ag_01',
    fieldName: 'Thửa A1 — kênh 7',
    online: true,
    batteryPct: 41,
    lastSeenAt: '2026-08-18T10:40:00+07:00',
    issue: null,
  },
  {
    id: 'st_dt_02',
    code: 'DT-02',
    name: 'Trạm bờ tây',
    orgId: ORG_DT,
    fieldId: 'fld_dt_02',
    fieldName: 'Thửa P3 — bờ tây',
    online: false,
    batteryPct: 8,
    lastSeenAt: '2026-08-18T04:12:00+07:00',
    issue: 'Mất kết nối sau mưa đêm',
  },
  {
    id: 'st_dt_01',
    code: 'DT-01',
    name: 'Trạm giồng cát',
    orgId: ORG_DT,
    fieldId: 'fld_dt_01',
    fieldName: 'Thửa P1 — giồng cát',
    online: true,
    batteryPct: 88,
    lastSeenAt: '2026-08-18T10:41:00+07:00',
    issue: null,
  },
  {
    id: 'st_mk_12',
    code: 'MK-12',
    name: 'Trạm cụm 2',
    orgId: ORG_MK,
    fieldId: 'fld_mk_12',
    fieldName: 'Thửa M12 — cụm 2',
    online: true,
    batteryPct: 18,
    lastSeenAt: '2026-08-18T10:38:00+07:00',
    issue: 'Pin thấp',
  },
  {
    id: 'st_mk_03',
    code: 'MK-03',
    name: 'Trạm bờ đông',
    orgId: ORG_MK,
    fieldId: 'fld_mk_03',
    fieldName: 'Thửa M3 — bờ đông',
    online: true,
    batteryPct: 64,
    lastSeenAt: '2026-08-18T10:39:00+07:00',
    issue: null,
  },
]

export const THRESHOLDS = {
  tempC: { min: 22, max: 34 },
  humidityPct: { min: 60, max: 90 },
  waterCm: { min: 3, max: 12 },
  lightLux: { min: 200, max: 1000 },
  soilMoisturePct: { min: 30, max: 65 },
}

function series(stationId, orgId, startHour, baseTemp, baseHum, baseWater, baseLight, baseSoil) {
  return Array.from({ length: 24 }, (_, index) => {
    const hour = (startHour + index) % 24
    const wobble = Math.sin(index / 3)
    return {
      id: `${stationId}_${index}`,
      stationId,
      orgId,
      recordedAt: `2026-08-18T${String(hour).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:00+07:00`,
      tempC: Number((baseTemp + wobble * 1.8).toFixed(1)),
      humidityPct: Math.round(baseHum + wobble * 6),
      waterCm: Number((baseWater + wobble * 0.8).toFixed(1)),
      lightLux: Math.round(baseLight + wobble * 90),
      soilMoisturePct: Math.round(baseSoil + wobble * 5),
    }
  })
}

export const SENSOR_READINGS = [
  ...series('st_ag_01', ORG_AG, 11, 24.2, 92, 4.1, 420, 55),
  ...series('st_ag_04', ORG_AG, 11, 27.1, 78, 2.1, 880, 38),
  ...series('st_dt_02', ORG_DT, 4, 23.5, 94, 6.4, 150, 72),
  ...series('st_dt_01', ORG_DT, 11, 28.4, 71, 5.2, 760, 48),
  ...series('st_mk_12', ORG_MK, 11, 35.1, 62, 7.0, 1400, 22),
  ...series('st_mk_03', ORG_MK, 11, 31.2, 68, 8.1, 640, 51),
]

export const STATION_ALERTS = [
  {
    id: 'sta_dt_02',
    stationId: 'st_dt_02',
    orgId: ORG_DT,
    fieldId: 'fld_dt_02',
    fieldName: 'Thửa P3 — bờ tây',
    kind: 'fault',
    title: 'Mất kết nối sau mưa đêm',
    body: 'Trạm DT-02 offline từ 04:12. Pin còn 8%. Đã gửi thông báo tới App nông dân.',
    createdAt: '2026-08-18T04:20:00+07:00',
  },
  {
    id: 'sta_mk_12',
    stationId: 'st_mk_12',
    orgId: ORG_MK,
    fieldId: 'fld_mk_12',
    fieldName: 'Thửa M12 — cụm 2',
    kind: 'fault',
    title: 'Pin thấp',
    body: 'Trạm MK-12 pin còn 18%. Nên kiểm tra trong tuần.',
    createdAt: '2026-08-16T10:20:00+07:00',
  },
  {
    id: 'sta_ag_04',
    stationId: 'st_ag_04',
    orgId: ORG_AG,
    fieldId: 'fld_ag_04',
    fieldName: 'Thửa A4 — đầu kênh',
    kind: 'threshold',
    title: 'Mực nước thấp hơn ngưỡng',
    body: 'Cảm biến AG-04: mực nước 2.1 cm liên tục 6 giờ.',
    createdAt: '2026-08-17T21:05:00+07:00',
  },
]

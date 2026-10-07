/** Fixed 9-class catalog — keep in sync with packages/rg_core/core/data/disease_catalog.py */

import { mergeActions, readDiseaseActionOverlay } from './diseasePlanOverlay.js'

export const DISEASE_CATALOG = [
  {
    code: 'Rice__BacterialLeafBlight',
    nameVi: 'Bạc lá',
    summary: 'Bệnh vi khuẩn Xanthomonas — vệt vàng xám dọc gân lá, dễ lan theo nước.',
    actions: [
      'Rút nước ruộng 2–3 ngày, không để nước chảy từ thửa bệnh sang thửa khỏe.',
      'Giảm phân đạm; ưu tiên kali và cân đối dinh dưỡng.',
      'Cắt bỏ lá bệnh nặng, thu gom ra khỏi ruộng — không vùi lại.',
      'Theo dõi 3–5 ngày; nếu lan nhanh, liên hệ khuyến nông trước khi dùng thuốc kháng khuẩn được phép.',
    ],
  },
  {
    code: 'Rice__BrownSpot',
    nameVi: 'Đốm nâu',
    summary: 'Nấm Helminthosporium — đốm nâu tròn, thường đi kèm đất nghèo dinh dưỡng.',
    actions: [
      'Bón bổ sung kali và silic; tránh thiếu dinh dưỡng kéo dài.',
      'Giữ mực nước ổn định, không để ruộng khô nứt.',
      'Loại bỏ rơm rạ bệnh từ vụ trước nếu còn trên bờ.',
      'Nếu tỷ lệ lá bệnh > 10%, cân nhắc thuốc trừ nấm đúng loại và liều trên bao bì.',
    ],
  },
  {
    code: 'Rice__Healthy',
    nameVi: 'Khỏe mạnh',
    summary: 'Không thấy triệu chứng bệnh trên ảnh đã quét.',
    actions: [
      'Tiếp tục theo dõi thửa theo lịch; không phun thuốc.',
      'Giữ mực nước và phân bón đúng giai đoạn sinh trưởng.',
      'Nhắc nông dân chụp lại nếu xuất hiện đốm mới hoặc lá vàng bất thường.',
    ],
  },
  {
    code: 'Rice__Hispa',
    nameVi: 'Hispa',
    summary: 'Sâu Hispa cạo biểu bì lá — vệt trắng song song, có thể thấy ấu trùng.',
    actions: [
      'Kiểm tra mật độ sâu trên ruộng vào sáng sớm.',
      'Nếu mật độ thấp: ngắt lá bị hại, dùng bẫy đèn buổi tối.',
      'Giữ nước vừa phải, vệ sinh cỏ bờ để giảm nơi ẩn nấp.',
      'Khi vượt ngưỡng gây hại, dùng thuốc trừ sâu được phép theo hướng dẫn khuyến nông.',
    ],
  },
  {
    code: 'Rice__LeafBlast',
    nameVi: 'Đạo ôn lá',
    summary: 'Nấm Pyricularia — vết thoi xám, dễ bùng phát khi ẩm cao và đêm mát.',
    actions: [
      'Rút cạn nước 1–2 ngày rồi cho nước trở lại; giảm đạm ngay.',
      'Tránh phun phân bón lá giàu đạm trong giai đoạn bệnh.',
      'Theo dõi ẩm lá và nhiệt độ đêm; tăng tuần suất kiểm tra.',
      'Nếu bệnh lan trên nhiều thửa, dùng thuốc đặc trị đạo ôn đúng giai đoạn (tricyclazole hoặc hoạt chất tương đương được phép).',
    ],
  },
  {
    code: 'Rice__LeafScald',
    nameVi: 'Cháy lá',
    summary: 'Vệt cháy từ chóp hoặc mép lá vào trong, thường khi đạm cao và ẩm kéo dài.',
    actions: [
      'Giảm phân đạm, tăng kali; không bón thúc khi lá đang ướt.',
      'Cải thiện thoát nước, tránh ngập lâu.',
      'Cắt lá cháy nặng nếu tập trung một góc ruộng.',
      'Theo dõi 5–7 ngày; bệnh thường chậm hơn đạo ôn.',
    ],
  },
  {
    code: 'Rice__LeafSmut',
    nameVi: 'Than lá',
    summary: 'Đốm than nhỏ trên phiến lá; thường hại nhẹ, ít làm giảm năng suất mạnh.',
    actions: [
      'Nhổ hoặc cắt cây bệnh nặng, không để bào tử phát tán khi thu hoạch giống.',
      'Không lấy giống từ ruộng đã nhiễm.',
      'Cân đối phân, tránh đạm dư.',
      'Chỉ xử lý thuốc khi tỷ lệ cây bệnh cao trên diện rộng.',
    ],
  },
  {
    code: 'Rice__NarrowBrownLeafSpot',
    nameVi: 'Đốm nâu hẹp',
    summary: 'Vệt nâu hẹp dọc gân lá, hay gặp khi thiếu kali.',
    actions: [
      'Bón kali theo khuyến cáo giai đoạn đẻ nhánh — làm đòng.',
      'Giữ mực nước ổn định, không để khô hạn xen kẽ ngập úng.',
      'Vệ sinh cỏ dại quanh bờ.',
      'Theo dõi thêm 1 tuần; nếu đốm dày đặc, cân nhắc thuốc trừ nấm lá.',
    ],
  },
  {
    code: 'Rice__NeckBlast',
    nameVi: 'Đạo ôn cổ bông',
    summary: 'Đạo ôn tấn công cổ bông — nguy cơ mất năng suất cao, cần xử lý khẩn.',
    actions: [
      'Ưu tiên kiểm tra thực địa trong ngày; đây là mức rủi ro cao.',
      'Giảm đạm, giữ ẩm đất vừa phải, tránh để cổ bông ướt kéo dài.',
      'Phun thuốc đặc trị đạo ôn đúng thời điểm trổ — ngậm sữa theo khuyến nông địa phương.',
      'Ghi nhật ký phun và theo dõi các thửa lân cận.',
    ],
  },
]

const BY_CODE = Object.fromEntries(DISEASE_CATALOG.map((row) => [row.code, row]))
const BY_NAME = Object.fromEntries(DISEASE_CATALOG.map((row) => [row.nameVi.toLowerCase(), row]))

/** Includes imported extra actions from localStorage overlay when available. */
export function getDisease(codeOrName) {
  if (!codeOrName) return null
  const key = String(codeOrName).trim()
  const base = BY_CODE[key] || BY_NAME[key.toLowerCase()] || null
  if (!base) return null
  const overlay = readDiseaseActionOverlay()
  return {
    ...base,
    actions: mergeActions(base.actions, overlay[base.code] || []),
  }
}

export function solutionFor(codeOrName) {
  const entry = getDisease(codeOrName)
  if (!entry) return null
  return {
    code: entry.code,
    nameVi: entry.nameVi,
    summary: entry.summary,
    actions: [...entry.actions],
  }
}

export function namesMatch(appName, webName) {
  if (!appName || !webName) return null
  const left = getDisease(appName)
  const right = getDisease(webName)
  if (left && right) return left.code === right.code
  return String(appName).trim().toLowerCase() === String(webName).trim().toLowerCase()
}

export function withPhotoSolution(photo) {
  const solution =
    photo.solution || solutionFor(photo.rescanClass) || solutionFor(photo.rescanDisease)
  const match =
    photo.match ?? namesMatch(photo.disease, photo.rescanDisease || photo.rescanClass)
  return { ...photo, solution: solution || null, match }
}

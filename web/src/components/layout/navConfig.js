const CULTIVATION_ITEMS = [
  { to: '/technician', label: 'Dashboard vùng trồng', icon: 'speedometer2', end: true, code: 'D1' },
  { to: '/technician/map', label: 'Bản đồ vùng trồng', icon: 'map', code: 'D2' },
  { to: '/technician/alerts', label: 'Cảnh báo bệnh hại', icon: 'exclamation-triangle', code: 'D3' },
  { to: '/technician/sensors', label: 'Cảm biến IoT', icon: 'graph-up', code: 'D5' },
  { to: '/technician/photos', label: 'Ảnh nông dân', icon: 'camera', code: 'D6' },
  { to: '/technician/uav', label: 'Dữ liệu UAV', icon: 'airplane', code: 'D7' },
  { to: '/technician/logs', label: 'Nhật ký đồng ruộng', icon: 'journal-richtext', code: 'D8' },
  { to: '/technician/inspections', label: 'Lịch kiểm tra thực địa', icon: 'calendar-check', code: 'D10' },
]

export const CULTIVATION_NAV = [{ group: 'Canh tác' }, ...CULTIVATION_ITEMS]

export const NAV = {
  admin: [
    { group: 'Hệ thống' },
    { to: '/admin', label: 'Dashboard', icon: 'speedometer2', end: true, code: 'B0' },
    { to: '/technician/map', label: 'Quản lý vùng', icon: 'map', code: 'D2' },
    { to: '/technician/uav', label: 'Dữ liệu từ UAV', icon: 'airplane', code: 'D7' },
    { to: '/admin/devices', label: 'Thiết bị IoT', icon: 'cpu', code: 'B3' },
    { to: '/technician/logs', label: 'Nhật ký quản lý vùng', icon: 'journal-richtext', code: 'D8' },
    { to: '/technician/inspections', label: 'Lịch kiểm tra', icon: 'calendar-check', code: 'D10' },
    { to: '/admin/disease-plans', label: 'Phương án giải quyết bệnh cây lúa', icon: 'clipboard2-pulse', code: 'B9' },
    { to: '/admin/staff', label: 'Quản lý tài khoản', icon: 'person-gear', code: 'B1_STAFF' },
    { group: 'Tài khoản khách hàng' },
    { to: '/admin/users', label: 'Quản lý tài khoản khách hàng', icon: 'people', code: 'B1' },
    {
      to: '/technician/alerts?type=image',
      label: 'Cảnh báo bệnh',
      icon: 'exclamation-triangle',
      code: 'D3',
    },
    { to: '/technician/photos', label: 'Dữ liệu từ khách hàng', icon: 'camera', code: 'D6' },
    { to: '/admin/articles', label: 'Bản tin nông dân', icon: 'newspaper', code: 'B11' },
    { to: '/admin/article-questions', label: 'Hỏi đáp bản tin', icon: 'chat-dots', code: 'B12' },
    { to: '/admin/audit', label: 'Nhật ký hoạt động', icon: 'journal-text', code: 'B7' },
  ],
  manager: [
    { group: 'Đơn vị' },
    { to: '/manager', label: 'Dashboard đơn vị', icon: 'speedometer2', end: true },
    { to: '/manager/technicians', label: 'Kỹ thuật viên', icon: 'person-badge', code: 'C2' },
    { to: '/manager/fields', label: 'Vùng trồng / thửa ruộng', icon: 'layers', code: 'C3' },
    { to: '/manager/season-reports', label: 'Báo cáo mùa vụ', icon: 'bar-chart', code: 'C4' },
    { to: '/manager/traceability', label: 'Truy xuất nguồn gốc', icon: 'file-earmark-text', code: 'C5' },
    { to: '/manager/farmers', label: 'Hộ nông dân', icon: 'people', code: 'C6' },
    { to: '/manager/map', label: 'Bản đồ vùng trồng', icon: 'map', code: 'D2' },
  ],
  technician: [
    { group: 'Canh tác' },
    CULTIVATION_ITEMS[0],
    {
      to: '/my-orgs',
      label: 'Đơn vị của tôi',
      icon: 'buildings',
      code: 'A2',
      when: (ctx) => ctx.organizations.length > 1,
    },
    ...CULTIVATION_ITEMS.slice(1),
    { to: '/technician/articles', label: 'Bản tin nông dân', icon: 'newspaper', code: 'B11' },
    { to: '/technician/article-questions', label: 'Hỏi đáp bản tin', icon: 'chat-dots', code: 'B12' },
  ],
}

const SHARED_BASE = [
  { group: 'Chung' },
  { to: '/notifications', label: 'Thông báo', icon: 'bell', code: 'E1' },
]

const SHARED_DEFAULT = [
  ...SHARED_BASE,
  { to: '/search', label: 'Tìm kiếm', icon: 'search', code: 'E2' },
  { to: '/settings', label: 'Cài đặt', icon: 'gear', code: 'E3' },
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: 'person-circle', code: 'A3' },
]

const SHARED_ADMIN = [
  ...SHARED_BASE,
  { to: '/admin/alerts', label: 'Cảnh báo', icon: 'shield-exclamation', code: 'B10' },
  { to: '/settings', label: 'Cài đặt chung', icon: 'gear', code: 'E3' },
]

/** @deprecated Prefer getSharedNav(role) */
export const SHARED_NAV = SHARED_DEFAULT

export function getSharedNav(role) {
  if (role === 'admin') return SHARED_ADMIN
  return SHARED_DEFAULT
}

export function homePath(role) {
  if (role === 'admin') return '/admin'
  if (role === 'manager') return '/manager'
  return '/technician'
}

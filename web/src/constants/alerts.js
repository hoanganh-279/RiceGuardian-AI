export const RISK_LABEL = {
  high: 'Nguy cơ cao',
  medium: 'Trung bình',
  low: 'Ổn định',
}

export const ALERT_TYPE_LABEL = {
  environment: 'Cảnh báo nguy cơ',
  image: 'Nhận diện từ ảnh',
}

export const ALERT_TYPE_HINT = {
  environment: 'Dự báo — điều kiện môi trường bất thường, chưa chắc đã có bệnh',
  image: 'Đã có biểu hiện — AI nhận diện trên ảnh App nông dân hoặc UAV',
}

export const ALERT_STATUS_LABEL = {
  open: 'Chưa phản hồi',
  confirmed: 'Chính xác',
  incorrect: 'Sai',
  watch: 'Cần theo dõi thêm',
}

export const FEEDBACK_OPTIONS = [
  { value: 'confirmed', label: 'Chính xác' },
  { value: 'incorrect', label: 'Sai' },
  { value: 'watch', label: 'Cần theo dõi thêm' },
]

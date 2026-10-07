// Port of web/src/constants/alerts.js — Vietnamese alert labels.

const Map<String, String> kRiskLabel = {
  'high': 'Nguy cơ cao',
  'medium': 'Trung bình',
  'low': 'Ổn định',
};

const Map<String, String> kAlertTypeLabel = {
  'environment': 'Cảnh báo nguy cơ',
  'image': 'Nhận diện từ ảnh',
};

const Map<String, String> kAlertTypeHint = {
  'environment':
      'Dự báo — điều kiện môi trường bất thường, chưa chắc đã có bệnh',
  'image': 'Đã có biểu hiện — AI nhận diện trên ảnh App nông dân hoặc UAV',
};

const Map<String, String> kAlertStatusLabel = {
  'open': 'Chưa phản hồi',
  'confirmed': 'Chính xác',
  'incorrect': 'Sai',
  'watch': 'Cần theo dõi thêm',
};

String riskLabel(String? level) => kRiskLabel[level] ?? level ?? '—';

String alertTypeLabel({required bool isEnvironment}) =>
    isEnvironment ? kAlertTypeLabel['environment']! : kAlertTypeLabel['image']!;

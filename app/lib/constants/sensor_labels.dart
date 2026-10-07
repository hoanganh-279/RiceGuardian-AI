// Port of web/src/constants/sensors.js — IoT metric labels for F7.

class SensorMetric {
  const SensorMetric({
    required this.key,
    required this.label,
    required this.unit,
    required this.short,
  });

  final String key;
  final String label;
  final String unit;
  final String short;
}

const List<SensorMetric> kSensorMetrics = [
  SensorMetric(key: 'tempC', label: 'Nhiệt độ', unit: '°C', short: 'Nhiệt'),
  SensorMetric(
    key: 'humidityPct',
    label: 'Độ ẩm không khí',
    unit: '%',
    short: 'Ẩm KK',
  ),
  SensorMetric(key: 'waterCm', label: 'Mực nước', unit: 'cm', short: 'Nước'),
  SensorMetric(key: 'lightLux', label: 'Ánh sáng', unit: 'lux', short: 'Sáng'),
  SensorMetric(
    key: 'soilMoisturePct',
    label: 'Độ ẩm đất',
    unit: '%',
    short: 'Ẩm đất',
  ),
];

SensorMetric? sensorMetricByKey(String key) {
  for (final m in kSensorMetrics) {
    if (m.key == key) return m;
  }
  return null;
}

String formatMetricValue(String key, num? value) {
  if (value == null) return '—';
  final metric = sensorMetricByKey(key);
  final unit = metric?.unit ?? '';
  if (key == 'lightLux') return '${value.round()} $unit';
  if (key == 'humidityPct' || key == 'soilMoisturePct') {
    return '${value.round()}$unit';
  }
  return '$value$unit';
}

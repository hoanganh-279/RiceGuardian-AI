class SensorReading {
  const SensorReading({
    required this.nodeId,
    required this.seq,
    required this.recordedAt,
    this.tempC,
    this.humidityPct,
    this.waterCm,
    this.lightLux,
    this.soilMoisturePct,
    this.battery,
    this.rssi,
    this.hop,
    this.topic,
  });

  final int nodeId;
  final int seq;
  final DateTime recordedAt;
  final double? tempC;
  final double? humidityPct;
  final double? waterCm;
  final double? lightLux;
  final double? soilMoisturePct;
  final double? battery;
  final int? rssi;
  final int? hop;
  final String? topic;

  num? valueFor(String key) {
    switch (key) {
      case 'tempC':
        return tempC;
      case 'humidityPct':
        return humidityPct;
      case 'waterCm':
        return waterCm;
      case 'lightLux':
        return lightLux;
      case 'soilMoisturePct':
        return soilMoisturePct;
    }
    return null;
  }

  bool get hasAnyMetric =>
      tempC != null ||
      humidityPct != null ||
      waterCm != null ||
      lightLux != null ||
      soilMoisturePct != null;

  Map<String, dynamic> toJson() => {
    'nodeId': nodeId,
    'seq': seq,
    'recordedAt': recordedAt.toIso8601String(),
    'temperature': tempC,
    'humidity': humidityPct,
    'waterLevel': waterCm,
    'tempC': tempC,
    'humidityPct': humidityPct,
    'waterCm': waterCm,
    'battery': battery,
    'rssi': rssi,
    'hop': hop,
    'topic': topic,
  };
}

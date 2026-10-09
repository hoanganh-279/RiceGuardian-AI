import 'dart:convert';

import '../models/sensor_reading_model.dart';

SensorReading? parseMqttPayload(String topic, String text) {
  if (text.trim().isEmpty) return null;
  Object? decoded;
  try {
    decoded = jsonDecode(text);
  } catch (_) {
    return null;
  }
  if (decoded is! Map<String, dynamic>) return null;
  return parseSensorReadingJson(topic, decoded);
}

SensorReading? parseSensorReadingJson(String topic, Map<String, dynamic> json) {
  final node = json['node_id'] ?? json['nodeId'];
  final seq = json['seq'];
  if (node is! num || seq is! num) return null;

  return SensorReading(
    nodeId: node.toInt(),
    seq: seq.toInt(),
    recordedAt: _parseTime(json['ts'] ?? json['timestamp']),
    tempC: _numOf(json, ['temp', 'temperature', 'tempC']),
    humidityPct: _numOf(json, ['humi', 'humidity', 'humidityPct']),
    waterCm: _numOf(json, ['water', 'waterCm', 'waterLevel']),
    lightLux: _numOf(json, ['light', 'lightLux']),
    soilMoisturePct: _numOf(json, ['soil', 'soilMoisturePct']),
    battery: _numOf(json, ['battery']),
    rssi: _intOf(json, ['rssi']),
    hop: _intOf(json, ['hop']),
    topic: topic,
  );
}

double? _numOf(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final value = json[key];
    if (value is num) return value.toDouble();
  }
  return null;
}

int? _intOf(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final value = json[key];
    if (value is num) return value.toInt();
  }
  return null;
}

DateTime _parseTime(Object? value) {
  if (value is num) {
    return DateTime.fromMillisecondsSinceEpoch(
      (value * 1000).round(),
      isUtc: true,
    ).toLocal();
  }
  if (value is String) {
    final parsed = DateTime.tryParse(value);
    if (parsed != null) return parsed.toLocal();
  }
  return DateTime.now();
}

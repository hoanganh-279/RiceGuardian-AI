import 'package:app_riceguardianai/services/mqtt_payload_parser.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseMqttPayload', () {
    const topic = 'riceguardian/station/3/reading';

    test('parses a full valid JSON payload', () {
      final reading = parseMqttPayload(
        topic,
        '{"node_id":3,"seq":145,"hop":2,"rssi":-89,"battery":3.7,"ts":1700000000,'
        '"temp":28.5,"humi":65,"water":7,"light":420,"soil":48}',
      );
      expect(reading, isNotNull);
      expect(reading!.nodeId, 3);
      expect(reading.seq, 145);
      expect(reading.hop, 2);
      expect(reading.rssi, -89);
      expect(reading.battery, closeTo(3.7, 0.001));
      expect(reading.tempC, closeTo(28.5, 0.001));
      expect(reading.humidityPct, closeTo(65, 0.001));
      expect(reading.waterCm, closeTo(7, 0.001));
      expect(reading.lightLux, closeTo(420, 0.001));
      expect(reading.soilMoisturePct, closeTo(48, 0.001));
      expect(reading.topic, topic);
    });

    test('missing node_id is rejected', () {
      expect(parseMqttPayload(topic, '{"seq":1,"temp":25}'), isNull);
    });

    test('missing seq is rejected', () {
      expect(parseMqttPayload(topic, '{"node_id":1,"temp":25}'), isNull);
    });

    test('non-JSON text is rejected', () {
      expect(parseMqttPayload(topic, 'hello world'), isNull);
    });

    test('non-object JSON is rejected', () {
      expect(parseMqttPayload(topic, '[1,2,3]'), isNull);
    });

    test('empty payload is rejected', () {
      expect(parseMqttPayload(topic, ''), isNull);
    });

    test('wrong numeric types are skipped', () {
      final reading = parseMqttPayload(
        topic,
        '{"node_id":"x","seq":1,"temp":25}',
      );
      expect(reading, isNull);
    });

    test('string timestamp is parsed', () {
      final reading = parseMqttPayload(
        topic,
        '{"node_id":1,"seq":1,"ts":"2026-10-08T12:00:00Z","temp":25}',
      );
      expect(reading, isNotNull);
      expect(reading!.tempC, closeTo(25, 0.001));
    });

    test('missing seq but valid node keeps other fields ignored', () {
      final reading = parseMqttPayload(
        topic,
        '{"node_id":1,"seq":2,"water":9,"soil":50}',
      );
      expect(reading, isNotNull);
      expect(reading!.waterCm, closeTo(9, 0.001));
      expect(reading.soilMoisturePct, closeTo(50, 0.001));
      expect(reading.tempC, isNull);
    });

    test('valueFor maps metric keys', () {
      final reading = parseSensorReadingJson(topic, {
        'node_id': 1,
        'seq': 1,
        'temp': 26,
        'humi': 70,
        'water': 8,
        'light': 500,
        'soil': 45,
      });
      expect(reading!.valueFor('tempC'), closeTo(26, 0.001));
      expect(reading.valueFor('humidityPct'), closeTo(70, 0.001));
      expect(reading.valueFor('waterCm'), closeTo(8, 0.001));
      expect(reading.valueFor('lightLux'), closeTo(500, 0.001));
      expect(reading.valueFor('soilMoisturePct'), closeTo(45, 0.001));
      expect(reading.valueFor('battery'), isNull);
      expect(reading.hasAnyMetric, isTrue);
    });
  });
}

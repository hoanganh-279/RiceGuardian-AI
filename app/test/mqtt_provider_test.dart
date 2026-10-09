import 'package:app_riceguardianai/models/field_model.dart';
import 'package:app_riceguardianai/models/mqtt_config.dart';
import 'package:app_riceguardianai/models/sensor_reading_model.dart';
import 'package:app_riceguardianai/providers/mqtt_provider.dart';
import 'package:app_riceguardianai/services/local_store.dart';
import 'package:app_riceguardianai/services/mqtt_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

SensorReading _reading(int nodeId, int seq, {double? temp}) {
  return SensorReading(
    nodeId: nodeId,
    seq: seq,
    recordedAt: DateTime(2026, 10, 8, 12, 0, seq),
    tempC: temp,
    topic: 'riceguardian/station/$nodeId/reading',
  );
}

FieldModel _field(String id, String name) => FieldModel(
  id: id,
  name: name,
  areaHa: 1.0,
  variety: 'OM 5451',
  currentSeason: 'Hè Thu 2026',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStore store;
  late MqttService service;
  late MqttDataProvider provider;

  Future<MqttDataProvider> makeProvider() async {
    final prefs = await SharedPreferences.getInstance();
    store = LocalStore(prefs: prefs);
    service = MqttService();
    provider = MqttDataProvider(store: store, service: service)
      ..autoConnect = false;
    await provider.bootstrap();
    return provider;
  }

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('bootstrap loads config and stays idle when disabled', () async {
    await makeProvider();
    expect(provider.enabled, isFalse);
    expect(provider.status, MqttLinkStatus.idle);
    expect(provider.latestByNode, isEmpty);
    provider.dispose();
  });

  test('enabled config with blank host does not attempt connection', () async {
    await makeProvider();
    await provider.applyConfig(const MqttConfig().copyWith(enabled: true));
    expect(provider.enabled, isFalse);
    expect(provider.config.enabled, isTrue);
    final saved = await store.getMqttConfig();
    expect(saved.enabled, isTrue);
    provider.dispose();
  });

  test('readings update latestByNode and history', () async {
    await makeProvider();

    service.emitReading(_reading(1, 1, temp: 25));
    service.emitReading(_reading(2, 1, temp: 30));
    await pumpEventQueue();

    expect(provider.latestByNode.length, 2);
    expect(provider.readingForNode(1)!.tempC, closeTo(25, 0.001));
    expect(provider.readingForNode(2)!.tempC, closeTo(30, 0.001));
    expect(provider.history.length, 2);
    provider.dispose();
  });

  test('older or duplicate seq is deduplicated', () async {
    await makeProvider();

    service.emitReading(_reading(1, 100, temp: 25));
    service.emitReading(_reading(1, 100, temp: 25));
    service.emitReading(_reading(1, 50, temp: 20));
    await pumpEventQueue();

    expect(provider.latestByNode.length, 1);
    expect(provider.readingForNode(1)!.seq, 100);
    expect(provider.readingForNode(1)!.tempC, closeTo(25, 0.001));
    expect(provider.history.length, 1);
    provider.dispose();
  });

  test('newer seq replaces previous reading', () async {
    await makeProvider();

    service.emitReading(_reading(1, 5, temp: 25));
    service.emitReading(_reading(1, 6, temp: 26));
    await pumpEventQueue();

    expect(provider.readingForNode(1)!.seq, 6);
    expect(provider.readingForNode(1)!.tempC, closeTo(26, 0.001));
    expect(provider.history.length, 2);
    provider.dispose();
  });

  test('readingForField maps by index across fields', () async {
    await makeProvider();

    final fields = [_field('field-a', 'A'), _field('field-b', 'B')];
    service.emitReading(_reading(3, 1, temp: 25));
    service.emitReading(_reading(7, 1, temp: 30));
    await pumpEventQueue();

    final forA = provider.readingForField('field-a', fields);
    final forB = provider.readingForField('field-b', fields);
    expect(forA, isNotNull);
    expect(forB, isNotNull);
    expect(forA!.nodeId == forB!.nodeId, isFalse);
    expect(forA.tempC, isNot(forB.tempC));

    final missing = provider.readingForField('field-c', fields);
    expect(missing, isNull);
    provider.dispose();
  });

  test('readingForField honors explicit fieldNodeMap', () async {
    await makeProvider();
    await provider.applyConfig(
      const MqttConfig().copyWith(
        enabled: true,
        host: '192.168.1.10',
        fieldNodeMap: {'field-z': 5},
      ),
    );

    final fields = [_field('field-z', 'Z'), _field('field-a', 'A')];
    service.emitReading(_reading(5, 1, temp: 22));
    service.emitReading(_reading(1, 1, temp: 33));
    await pumpEventQueue();

    final forZ = provider.readingForField('field-z', fields);
    expect(forZ!.nodeId, 5);
    expect(forZ.tempC, closeTo(22, 0.001));
    provider.dispose();
  });
}

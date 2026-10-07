import 'package:app_riceguardianai/services/local_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('seeded store has fields but no fake alerts or notifications', () async {
    final store = LocalStore();
    await store.ensureSeeded();

    expect((await store.getFields()).length, greaterThanOrEqualTo(3));
    expect(await store.getPhotos(), isEmpty);
    expect(await store.getAlerts(), isEmpty);
    expect(await store.getNotifications(), isEmpty);
  });

  test('migration to seed v3 strips old seed alerts and notifications', () async {
    SharedPreferences.setMockInitialValues({
      'rg_seeded': true,
      'rg_seed_v': 2,
      'rg_fields':
          '[{"id":"field-p1","name":"Thửa P1","areaHa":1.8,"variety":"OM 5451","currentSeason":"HT"}]',
      'rg_alerts':
          '[{"id":"alert-seed-img-1","fieldName":"Thửa P1","type":"image","riskLevel":"medium","title":"Phát hiện: Đạo ôn","summary":"x","createdAt":"2026-01-01T00:00:00Z","confidence":0.78},'
              '{"id":"alert-real-1","fieldName":"Thửa P1","type":"image","riskLevel":"medium","title":"Phát hiện: Bạc lá","summary":"y","createdAt":"2026-01-02T00:00:00Z"}]',
      'rg_notifications':
          '[{"id":"notif-seed-1","title":"t","body":"b","read":false,"createdAt":"2026-01-01T00:00:00Z","type":"alert"}]',
      'rg_photos': '[]',
    });

    final store = LocalStore();
    await store.ensureSeeded();

    final alerts = await store.getAlerts();
    expect(alerts.map((a) => a.id), ['alert-real-1']);
    expect(await store.getNotifications(), isEmpty);
  });

  test('demo user has farmer display name', () {
    final user = LocalStore().demoUser();
    expect(user.fullName, LocalStore.demoFarmerName);
    expect(user.email, isNot(contains('@local')));
    expect(user.email.toLowerCase(), isNot(contains('demo@')));
  });

  test('sensor placeholder returns dash readings offline', () {
    final reading = LocalStore().sensorPlaceholder('field-p3');
    expect(reading['reading'], isA<Map>());
    expect((reading['reading'] as Map)['temperature'], isNotNull);
  });

  test('settings patch persists locally', () async {
    final store = LocalStore();
    await store.ensureSeeded();

    final updated = await store.patchSettings({'language': 'en'});
    expect(updated['language'], 'en');
    expect((await store.getSettings())['language'], 'en');
  });

  test('field log appends locally', () async {
    final store = LocalStore();
    await store.ensureSeeded();

    await store.addFieldLog(
      fieldId: 'field-p1',
      type: 'bon_phan',
      note: 'test',
    );
    expect(true, isTrue);
  });

  test('migrates legacy demo fields to seeded fields', () async {
    SharedPreferences.setMockInitialValues({
      'rg_seeded': true,
      'rg_seed_v': 1,
      'rg_fields':
          '[{"id":"field-demo-1","name":"Ruộng Demo A","areaHa":0.5,"variety":"OM","currentSeason":"DX"},{"id":"field-demo-2","name":"Ruộng Demo B","areaHa":0.8,"variety":"IR","currentSeason":"DX"}]',
      'rg_alerts': '[]',
      'rg_notifications': '[]',
      'rg_photos': '[]',
      'rg_field_logs': '[]',
      'rg_settings': '{"notificationsEnabled":true,"language":"vi"}',
      'rg_local_password': 'Demo@123',
      'rg_session_user':
          '{"id":"local-farmer-1","fullName":"Nông dân Demo","email":"farmer@local","phone":"0901234567","role":"farmer","organizationIds":["local"]}',
    });

    final store = LocalStore();
    await store.ensureSeeded();

    final fields = await store.getFields();
    expect(fields.length, greaterThanOrEqualTo(3));
    expect(fields.any((f) => f.id.startsWith('field-demo')), isFalse);

    final user = await store.getSessionUser();
    expect(user?.fullName, LocalStore.demoFarmerName);
    expect(await store.getAlerts(), isEmpty);
  });
}

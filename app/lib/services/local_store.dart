import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/alert_model.dart';
import '../models/field_model.dart';
import '../models/notification_model.dart';
import '../models/photo_model.dart';
import '../models/user_model.dart';
import '../utils/metric_display.dart';

/// On-device persistence for the offline farmer app (no network API).
class LocalStore {
  LocalStore({SharedPreferences? prefs}) : _prefsOverride = prefs;

  static const _kSessionUser = 'rg_session_user';
  static const _kAccessToken = 'rg_access_token';
  static const _kRememberMe = 'rg_remember_me';
  static const _kPassword = 'rg_local_password';
  static const _kFields = 'rg_fields';
  static const _kPhotos = 'rg_photos';
  static const _kAlerts = 'rg_alerts';
  static const _kNotifications = 'rg_notifications';
  static const _kSettings = 'rg_settings';
  static const _kFieldLogs = 'rg_field_logs';
  static const _kSeeded = 'rg_seeded';
  static const _kSeedVersion = 'rg_seed_v';
  static const seedVersion = 3;

  static const demoPhone = '0901234567';
  static const demoPassword = 'Demo@123';
  static const demoFarmerName = 'Phạm Văn Đạt';
  static const demoFarmerEmail = 'phamvandat@htx.vn';

  final SharedPreferences? _prefsOverride;
  SharedPreferences? _prefs;

  Future<SharedPreferences> get _p async {
    _prefs ??= _prefsOverride ?? await SharedPreferences.getInstance();
    return _prefs!;
  }

  Future<void> ensureSeeded() async {
    final prefs = await _p;
    final version = prefs.getInt(_kSeedVersion) ?? 0;
    if (prefs.getBool(_kSeeded) == true && version >= seedVersion) return;

    if (prefs.getBool(_kSeeded) != true) {
      await prefs.setString(_kPassword, demoPassword);
      await prefs.setString(_kPhotos, '[]');
      await prefs.setString(_kFieldLogs, '[]');
      await prefs.setString(
        _kSettings,
        jsonEncode({'notificationsEnabled': true, 'language': 'vi'}),
      );
      await _writeJsonList(prefs, _kFields, _seedFields().map((f) => f.toJson()));
      await prefs.setString(_kAlerts, '[]');
      await prefs.setString(_kNotifications, '[]');
    } else {
      await _migrateDemoSeed(prefs);
    }

    await prefs.setBool(_kSeeded, true);
    await prefs.setInt(_kSeedVersion, seedVersion);
  }

  Future<void> _migrateDemoSeed(SharedPreferences prefs) async {
    final fields = _decodeFields(prefs.getString(_kFields));
    if (_isLegacyDemoFields(fields)) {
      await _writeJsonList(prefs, _kFields, _seedFields().map((f) => f.toJson()));
    }

    final userRaw = prefs.getString(_kSessionUser);
    if (userRaw != null && userRaw.isNotEmpty) {
      final user =
          UserModel.fromJson(jsonDecode(userRaw) as Map<String, dynamic>);
      if (_isLegacyDemoUser(user)) {
        await setSessionUser(
          demoUser(fullName: demoFarmerName, phone: user.phone),
        );
      }
    }

    final alerts = _decodeAlerts(prefs.getString(_kAlerts))
        .where((a) => !a.id.startsWith('alert-seed-'));
    await _writeJsonList(prefs, _kAlerts, alerts.map((a) => a.toJson()));

    final notifications = _decodeNotifications(prefs.getString(_kNotifications))
        .where((n) => !n.id.startsWith('notif-seed-'));
    await _writeJsonList(
      prefs,
      _kNotifications,
      notifications.map((n) => n.toJson()),
    );
  }

  List<FieldModel> _decodeFields(String? raw) {
    if (raw == null || raw.isEmpty) return [];
    return (jsonDecode(raw) as List<dynamic>)
        .map((e) => FieldModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  List<AlertModel> _decodeAlerts(String? raw) {
    if (raw == null || raw.isEmpty) return [];
    return (jsonDecode(raw) as List<dynamic>)
        .map((e) => AlertModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  List<NotificationModel> _decodeNotifications(String? raw) {
    if (raw == null || raw.isEmpty) return [];
    return (jsonDecode(raw) as List<dynamic>)
        .map((e) => NotificationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> _writeJsonList(
    SharedPreferences prefs,
    String key,
    Iterable<Map<String, dynamic>> items,
  ) {
    return prefs.setString(key, jsonEncode(items.toList()));
  }

  bool _isLegacyDemoFields(List<FieldModel> fields) {
    if (fields.isEmpty) return true;
    const legacyIds = {'field-demo-1', 'field-demo-2'};
    return fields.every((f) => legacyIds.contains(f.id));
  }

  bool _isLegacyDemoUser(UserModel user) {
    return user.fullName == 'Nông dân Demo' ||
        user.email == 'farmer@local' ||
        user.email == 'demo@app' ||
        user.email.endsWith('@local');
  }

  List<FieldModel> _seedFields() => [
        FieldModel(
          id: 'field-p1',
          name: 'Thửa P1 — giồng cát',
          areaHa: 1.8,
          variety: 'OM 5451',
          currentSeason: 'Hè Thu 2026',
          lat: 10.498,
          lng: 105.612,
        ),
        FieldModel(
          id: 'field-p3',
          name: 'Thửa P3 — bờ tây',
          areaHa: 2.1,
          variety: 'Đài Thơm 8',
          currentSeason: 'Hè Thu 2026',
          lat: 10.512,
          lng: 105.631,
        ),
        FieldModel(
          id: 'field-k8',
          name: 'Thửa kênh 8 — đầu bờ',
          areaHa: 1.2,
          variety: 'OM 18',
          currentSeason: 'Hè Thu 2026',
          lat: 10.505,
          lng: 105.620,
        ),
        FieldModel(
          id: 'field-bd',
          name: 'Thửa bưng — cuối kênh',
          areaHa: 0.9,
          variety: 'IR 50404',
          currentSeason: 'Hè Thu 2026',
          lat: 10.490,
          lng: 105.605,
        ),
      ];

  /// No sensor feed on device — every metric shows [metricDash].
  Map<String, dynamic> sensorPlaceholder(String fieldId) {
    return {
      'reading': {
        'temperature': metricDash,
        'humidity': metricDash,
        'waterLevel': metricDash,
        'tempC': metricDash,
        'humidityPct': metricDash,
        'waterCm': metricDash,
      },
      'station': metricDash,
      'batteryPct': metricDash,
      'hints': <String>[],
    };
  }

  UserModel demoUser({String? fullName, String? phone}) => UserModel(
        id: 'local-farmer-1',
        fullName: fullName ?? demoFarmerName,
        email: demoFarmerEmail,
        phone: phone ?? demoPhone,
        role: 'farmer',
        organizationIds: const ['local'],
      );

  Future<UserModel?> getSessionUser() async {
    final raw = (await _p).getString(_kSessionUser);
    if (raw == null || raw.isEmpty) return null;
    return UserModel.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> setSessionUser(UserModel? user) async {
    final prefs = await _p;
    if (user == null) {
      await prefs.remove(_kSessionUser);
    } else {
      await prefs.setString(_kSessionUser, jsonEncode(user.toJson()));
    }
  }

  Future<String?> getAccessToken() async {
    return (await _p).getString(_kAccessToken);
  }

  Future<void> setAccessToken(String? token) async {
    final prefs = await _p;
    if (token == null || token.isEmpty) {
      await prefs.remove(_kAccessToken);
    } else {
      await prefs.setString(_kAccessToken, token);
    }
  }

  Future<bool> getRememberMe() async {
    return (await _p).getBool(_kRememberMe) ?? true;
  }

  Future<void> setRememberMe(bool value) async {
    await (await _p).setBool(_kRememberMe, value);
  }

  Future<String> getPassword() async {
    await ensureSeeded();
    return (await _p).getString(_kPassword) ?? demoPassword;
  }

  Future<void> setPassword(String password) async {
    await (await _p).setString(_kPassword, password);
  }

  Future<List<FieldModel>> getFields() async {
    await ensureSeeded();
    return _decodeFields((await _p).getString(_kFields));
  }

  Future<void> saveFields(List<FieldModel> fields) async {
    await (await _p).setString(
      _kFields,
      jsonEncode(fields.map((f) => f.toJson()).toList()),
    );
  }

  Future<List<PhotoModel>> getPhotos() async {
    await ensureSeeded();
    final raw = (await _p).getString(_kPhotos) ?? '[]';
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => PhotoModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> savePhotos(List<PhotoModel> photos) async {
    await (await _p).setString(
      _kPhotos,
      jsonEncode(photos.map((p) => p.toJson()).toList()),
    );
  }

  Future<PhotoModel> savePhotoFile({
    required String sourcePath,
    required String fieldId,
    required String fieldName,
    required String disease,
    required double confidence,
    double? lat,
    double? lng,
  }) async {
    final dir = await getApplicationDocumentsDirectory();
    final photosDir = Directory('${dir.path}/photos');
    if (!await photosDir.exists()) {
      await photosDir.create(recursive: true);
    }
    final id = 'photo-${DateTime.now().millisecondsSinceEpoch}';
    final ext = sourcePath.contains('.') ? sourcePath.split('.').last : 'jpg';
    final destPath = '${photosDir.path}/$id.$ext';
    await File(sourcePath).copy(destPath);

    final photo = PhotoModel(
      id: id,
      fieldName: fieldName,
      imageUrl: destPath,
      disease: disease,
      capturedAt: DateTime.now().toIso8601String(),
      confidence: confidence,
      fieldId: fieldId,
      lat: lat,
      lng: lng,
      syncStatus: 'local',
    );
    final photos = await getPhotos();
    photos.insert(0, photo);
    await savePhotos(photos);

    if (disease != 'Khỏe mạnh') {
      final alerts = await getAlerts();
      alerts.insert(
        0,
        AlertModel(
          id: 'alert-${DateTime.now().millisecondsSinceEpoch}',
          fieldName: fieldName,
          type: 'image',
          riskLevel: confidence >= 0.7 ? 'high' : 'medium',
          title: 'Phát hiện: $disease',
          summary:
              'Ảnh chụp trên $fieldName — độ tin cậy $metricDash.',
          createdAt: DateTime.now().toIso8601String(),
          confidence: confidence,
        ),
      );
      await saveAlerts(alerts);

      final notifications = await getNotifications();
      notifications.insert(
        0,
        NotificationModel(
          id: 'notif-${DateTime.now().millisecondsSinceEpoch}',
          title: 'Cảnh báo bệnh mới',
          body: '$disease tại $fieldName',
          read: false,
          createdAt: DateTime.now().toIso8601String(),
          type: 'alert',
        ),
      );
      await saveNotifications(notifications);
    }

    return photo;
  }

  Future<List<AlertModel>> getAlerts() async {
    await ensureSeeded();
    return _decodeAlerts((await _p).getString(_kAlerts));
  }

  Future<void> saveAlerts(List<AlertModel> alerts) async {
    await (await _p).setString(
      _kAlerts,
      jsonEncode(alerts.map((a) => a.toJson()).toList()),
    );
  }

  Future<List<NotificationModel>> getNotifications() async {
    await ensureSeeded();
    return _decodeNotifications((await _p).getString(_kNotifications));
  }

  Future<void> saveNotifications(List<NotificationModel> items) async {
    await (await _p).setString(
      _kNotifications,
      jsonEncode(items.map((n) => n.toJson()).toList()),
    );
  }

  Future<Map<String, dynamic>> getSettings() async {
    await ensureSeeded();
    final raw = (await _p).getString(_kSettings);
    if (raw == null || raw.isEmpty) {
      return {'notificationsEnabled': true, 'language': 'vi'};
    }
    return Map<String, dynamic>.from(jsonDecode(raw) as Map);
  }

  Future<Map<String, dynamic>> patchSettings(Map<String, dynamic> patch) async {
    final current = await getSettings();
    current.addAll(patch);
    await (await _p).setString(_kSettings, jsonEncode(current));
    return current;
  }

  Future<void> addFieldLog({
    required String fieldId,
    required String type,
    String? note,
  }) async {
    await ensureSeeded();
    final prefs = await _p;
    final raw = prefs.getString(_kFieldLogs) ?? '[]';
    final list = (jsonDecode(raw) as List<dynamic>)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    list.insert(0, {
      'id': 'log-${DateTime.now().millisecondsSinceEpoch}',
      'fieldId': fieldId,
      'type': type,
      'note': note ?? '',
      'createdAt': DateTime.now().toIso8601String(),
    });
    await prefs.setString(_kFieldLogs, jsonEncode(list));
  }
}

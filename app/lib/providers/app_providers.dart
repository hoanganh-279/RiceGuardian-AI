import 'package:flutter/foundation.dart';

import '../models/alert_model.dart';
import '../models/article_model.dart';
import '../models/field_model.dart';
import '../models/notification_model.dart';
import '../models/paginated_result.dart';
import '../models/photo_model.dart';
import '../models/user_model.dart';
import '../services/app_exception.dart';
import '../services/auth_service.dart';
import '../services/farmer_remote_service.dart';
import '../services/site_news_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider(this._authService);

  final AuthService _authService;

  UserModel? _user;
  bool _loading = true;
  String? _error;
  bool _rememberMe = true;

  UserModel? get user => _user;
  bool get isLoading => _loading;
  bool get isAuthenticated => _user != null;
  String? get error => _error;
  bool get rememberMe => _rememberMe;
  AuthService get authService => _authService;
  bool get usesRemoteAuth => _authService.usesRemoteAuth;

  Future<void> bootstrap() async {
    _loading = true;
    notifyListeners();
    await _authService.store.ensureSeeded();
    _rememberMe = await _authService.store.getRememberMe();
    _user = await _authService.restoreSession();
    _loading = false;
    notifyListeners();
  }

  Future<void> setRememberMe(bool value) async {
    _rememberMe = value;
    await _authService.store.setRememberMe(value);
    notifyListeners();
  }

  Future<bool> login(String phone, String password) async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      _user = await _authService.login(phone, password);
      _loading = false;
      notifyListeners();
      return true;
    } catch (error) {
      _error = error is ApiException ? error.message : error.toString();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String fullName,
    required String email,
    required String phone,
    required String password,
  }) async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      _user = await _authService.register(
        fullName: fullName,
        email: email,
        phone: phone,
        password: password,
      );
      _loading = false;
      notifyListeners();
      return true;
    } catch (error) {
      _error = error is ApiException ? error.message : error.toString();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> loginWithGoogle() async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      _user = await _authService.loginWithGoogle();
      _loading = false;
      notifyListeners();
      return true;
    } catch (error) {
      _error = error is ApiException ? error.message : error.toString();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<Map<String, dynamic>?> requestPasswordReset(String identifier) async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      final payload = await _authService.forgotPassword(identifier);
      _loading = false;
      notifyListeners();
      return payload;
    } catch (error) {
      _error = error is ApiException ? error.message : error.toString();
      _loading = false;
      notifyListeners();
      return null;
    }
  }

  Future<bool> resetPassword({
    required String token,
    required String password,
  }) async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      await _authService.resetPassword(token: token, password: password);
      _loading = false;
      notifyListeners();
      return true;
    } catch (error) {
      _error = error is ApiException ? error.message : error.toString();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    _user = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void setUser(UserModel user) {
    _user = user;
    notifyListeners();
  }
}

class AppDataProvider extends ChangeNotifier {
  AppDataProvider(this._auth);

  final AuthProvider _auth;

  late final FarmerRemoteService _remote = FarmerRemoteService(_auth.authService);

  FarmerRemoteService get remote => _remote;

  int fieldCount = 0;
  List<AlertModel> latestAlerts = [];
  int unreadNotifications = 0;
  List<FieldModel> fields = [];
  List<AlertModel> alerts = [];
  List<PhotoModel> photos = [];
  List<NotificationModel> notifications = [];
  List<ArticleModel> latestArticles = [];
  Map<String, dynamic>? settings;
  bool loading = false;
  String? error;
  String? syncMessage;

  bool get usesRemote => _auth.usesRemoteAuth;

  Future<void> refreshDashboard() async {
    final hasCache =
        fields.isNotEmpty || latestAlerts.isNotEmpty || fieldCount > 0;
    if (!hasCache) {
      loading = true;
      notifyListeners();
    }
    error = null;
    try {
      await Future.wait([
        refreshFields(),
        refreshAlerts(),
        refreshNotifications(),
        refreshArticles(),
      ]);
      if (usesRemote) {
        await flushPendingUploads();
      }
      fieldCount = fields.length;
      latestAlerts = alerts.take(5).toList();
    } catch (e) {
      error = e.toString();
    }
    loading = false;
    notifyListeners();
  }

  Future<void> refreshArticles() async {
    var site = <ArticleModel>[];
    var remote = <ArticleModel>[];
    try {
      site = await SiteNewsService.instance.loadAll();
    } catch (_) {}
    if (usesRemote) {
      try {
        remote = await _remote.fetchArticles(limit: 10);
      } catch (_) {}
    }
    latestArticles = SiteNewsService.merge(site, remote);
    notifyListeners();
  }

  Future<void> refreshFields() async {
    try {
      if (usesRemote) {
        final remoteFields = await _remote.fetchFields();
        if (remoteFields.isNotEmpty) {
          await _auth.authService.store.saveFields(remoteFields);
          fields = remoteFields;
        } else {
          fields = await _auth.authService.store.getFields();
        }
      } else {
        fields = await _auth.authService.store.getFields();
      }
      fieldCount = fields.length;
      notifyListeners();
    } catch (_) {
      fields = await _auth.authService.store.getFields();
      fieldCount = fields.length;
      notifyListeners();
    }
  }

  Future<void> refreshAlerts() async {
    try {
      alerts = await _auth.authService.store.getAlerts();
      latestAlerts = alerts.take(5).toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<PaginatedResult<PhotoModel>> loadPhotos({required int page}) async {
    final all = await _auth.authService.store.getPhotos();
    const limit = 20;
    final start = (page - 1) * limit;
    if (start >= all.length) {
      return PaginatedResult(items: [], page: page, limit: limit, total: all.length);
    }
    final end = (start + limit).clamp(0, all.length);
    final items = all.sublist(start, end);
    photos = all;
    notifyListeners();
    return PaginatedResult(
      items: items,
      page: page,
      limit: limit,
      total: all.length,
    );
  }

  Future<void> refreshNotifications() async {
    try {
      if (usesRemote) {
        try {
          final remote = await _remote.fetchNotifications();
          final local = await _auth.authService.store.getNotifications();
          final byId = <String, NotificationModel>{
            for (final n in local) n.id: n,
          };
          for (final n in remote) {
            byId[n.id] = n;
          }
          final merged = byId.values.toList()
            ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
          await _auth.authService.store.saveNotifications(merged);
          notifications = merged;
        } catch (_) {
          notifications = await _auth.authService.store.getNotifications();
        }
      } else {
        notifications = await _auth.authService.store.getNotifications();
      }
      unreadNotifications = notifications.where((n) => !n.read).length;
      notifyListeners();
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> loadSensor(String fieldId) async {
    if (usesRemote) {
      return null;
    }
    return _auth.authService.store.sensorPlaceholder(fieldId);
  }

  Future<void> loadSettings() async {
    settings = await _auth.authService.store.getSettings();
    notifyListeners();
  }

  Future<void> saveSettings(Map<String, dynamic> patch) async {
    settings = await _auth.authService.store.patchSettings(patch);
    notifyListeners();
  }

  Future<void> markNotificationRead(String id) async {
    if (usesRemote) {
      try {
        await _remote.markNotificationRead(id);
      } catch (_) {}
    }
    final items = await _auth.authService.store.getNotifications();
    final updated = items
        .map((n) => n.id == id ? n.copyWith(read: true) : n)
        .toList();
    await _auth.authService.store.saveNotifications(updated);
    await refreshNotifications();
  }

  Future<void> createFieldLog({
    required String fieldId,
    required String type,
    String? note,
  }) async {
    await _auth.authService.store.addFieldLog(
      fieldId: fieldId,
      type: type,
      note: note,
    );
  }

  Future<PhotoModel> saveLocalPhoto({
    required String filePath,
    required FieldModel field,
    required String disease,
    required double confidence,
    double? lat,
    double? lng,
  }) async {
    var photo = await _auth.authService.store.savePhotoFile(
      sourcePath: filePath,
      fieldId: field.id,
      fieldName: field.name,
      disease: disease,
      confidence: confidence,
      lat: lat,
      lng: lng,
    );

    if (usesRemote) {
      photo = photo.copyWith(syncStatus: 'pending');
      await _replacePhoto(photo);
      try {
        final synced = await _remote.uploadPhoto(photo);
        await _replacePhoto(synced);
        photo = synced;
        syncMessage = null;
      } catch (err) {
        final failed = photo.copyWith(syncStatus: 'error');
        await _replacePhoto(failed);
        photo = failed;
        syncMessage = err is ApiException
            ? err.message
            : 'Chưa đồng bộ ảnh lên server. Thử lại sau.';
      }
    }

    await refreshAlerts();
    await refreshNotifications();
    notifyListeners();
    return photo;
  }

  Future<void> flushPendingUploads() async {
    if (!usesRemote) return;
    try {
      final n = await _remote.flushPendingUploads();
      if (n > 0) {
        syncMessage = 'Đã đồng bộ $n ảnh đang chờ.';
      }
      photos = await _auth.authService.store.getPhotos();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _replacePhoto(PhotoModel photo) async {
    final all = await _auth.authService.store.getPhotos();
    final idx = all.indexWhere((p) => p.id == photo.id);
    if (idx >= 0) {
      all[idx] = photo;
    } else {
      all.insert(0, photo);
    }
    await _auth.authService.store.savePhotos(all);
  }
}

import 'package:google_sign_in/google_sign_in.dart';

import '../config/google_auth_config.dart';
import '../models/user_model.dart';
import 'api_client.dart';
import 'app_exception.dart';
import 'local_store.dart';

class AuthService {
  AuthService({LocalStore? store, ApiClient? api, GoogleSignIn? googleSignIn})
      : _store = store ?? LocalStore(),
        _api = api ?? ApiClient(),
        _googleSignIn = googleSignIn ??
            GoogleSignIn(
              scopes: const ['email', 'profile'],
              serverClientId: kGoogleServerClientId,
            );

  final LocalStore _store;
  final ApiClient _api;
  final GoogleSignIn _googleSignIn;

  /// In-memory session when "remember me" is off.
  UserModel? _memoryUser;
  String? _memoryToken;

  LocalStore get store => _store;
  ApiClient get api => _api;

  /// Online when `API_BASE_URL` is set via --dart-define (or injected ApiClient).
  bool get usesRemoteAuth => _api.isConfigured;

  Future<void> _persistSession(UserModel user, String? token) async {
    final remember = await _store.getRememberMe();
    _api.accessToken = token;
    if (remember) {
      _memoryUser = null;
      _memoryToken = null;
      await _store.setSessionUser(user);
      await _store.setAccessToken(token);
    } else {
      _memoryUser = user;
      _memoryToken = token;
      await _store.setSessionUser(null);
      await _store.setAccessToken(null);
    }
  }

  Future<UserModel> login(String identifier, String password) async {
    await _store.ensureSeeded();
    final phone = identifier.trim();

    if (!usesRemoteAuth) {
      return _loginLocal(phone, password);
    }

    final payload = await _api.post(
      '/api/auth/login',
      body: {'identifier': phone, 'password': password},
      auth: false,
    );

    return _sessionFromPayload(payload);
  }

  Future<UserModel> register({
    required String fullName,
    required String email,
    required String phone,
    required String password,
  }) async {
    await _store.ensureSeeded();

    if (!usesRemoteAuth) {
      throw ApiException(
        'Đăng ký cần kết nối máy chủ. Hãy cấu hình API_BASE_URL.',
      );
    }

    final payload = await _api.post(
      '/api/auth/register',
      body: {
        'fullName': fullName.trim(),
        'email': email.trim(),
        'phone': phone.trim(),
        'password': password,
      },
      auth: false,
    );
    return _sessionFromPayload(payload);
  }

  Future<UserModel> loginWithGoogle() async {
    await _store.ensureSeeded();

    if (!usesRemoteAuth) {
      throw ApiException(
        'Đăng nhập Google cần kết nối máy chủ. Hãy cấu hình API_BASE_URL.',
      );
    }

    final account = await _googleSignIn.signIn();
    if (account == null) {
      throw ApiException('Đã hủy đăng nhập Google.');
    }
    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw ApiException(
        'Không lấy được Google idToken. Kiểm tra OAuth Android client + SHA-1.',
      );
    }

    final payload = await _api.post(
      '/api/auth/google',
      body: {'idToken': idToken},
      auth: false,
    );
    return _sessionFromPayload(payload);
  }

  Future<Map<String, dynamic>> forgotPassword(String identifier) async {
    if (!usesRemoteAuth) {
      throw ApiException(
        'Quên mật khẩu cần kết nối máy chủ. Hãy cấu hình API_BASE_URL.',
      );
    }
    return _api.post(
      '/api/auth/forgot-password',
      body: {'identifier': identifier.trim()},
      auth: false,
    );
  }

  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    if (!usesRemoteAuth) {
      throw ApiException(
        'Đặt lại mật khẩu cần kết nối máy chủ. Hãy cấu hình API_BASE_URL.',
      );
    }
    await _api.post(
      '/api/auth/reset-password',
      body: {'token': token.trim(), 'password': password},
      auth: false,
    );
  }

  Future<UserModel> _sessionFromPayload(Map<String, dynamic> payload) async {
    final token = payload['access_token']?.toString() ?? '';
    final userJson = payload['user'];
    if (token.isEmpty || userJson is! Map<String, dynamic>) {
      throw ApiException('Phản hồi đăng nhập không hợp lệ.');
    }

    final user = UserModel.fromJson(userJson);
    if (user.role != 'farmer') {
      throw ApiException('Tài khoản này không dùng được trên app nông dân.');
    }

    await _persistSession(user, token);
    return user;
  }

  Future<UserModel> _loginLocal(String phone, String password) async {
    final expected = await _store.getPassword();
    if (phone != LocalStore.demoPhone || password != expected) {
      throw ApiException('Số điện thoại hoặc mật khẩu không đúng.');
    }

    final existing = await _store.getSessionUser();
    final user = (existing != null && existing.phone == phone)
        ? existing
        : (_memoryUser != null && _memoryUser!.phone == phone)
            ? _memoryUser!
            : _store.demoUser(phone: phone);
    await _persistSession(user, null);
    return user;
  }

  Future<UserModel?> restoreSession() async {
    await _store.ensureSeeded();

    if (_memoryUser != null) {
      if (_memoryUser!.role != 'farmer') return null;
      _api.accessToken = _memoryToken;
      return _memoryUser;
    }

    final remember = await _store.getRememberMe();
    if (!remember) {
      return null;
    }

    final user = await _store.getSessionUser();
    if (user == null || user.role != 'farmer') return null;

    if (!usesRemoteAuth) {
      return user;
    }

    final token = await _store.getAccessToken();
    if (token == null || token.isEmpty) {
      await _clearSession();
      return null;
    }

    _api.accessToken = token;
    try {
      final payload = await _api.get('/api/auth/me');
      final userJson = payload['user'];
      if (userJson is! Map<String, dynamic>) {
        await _clearSession();
        return null;
      }
      final refreshed = UserModel.fromJson(userJson);
      if (refreshed.role != 'farmer') {
        await _clearSession();
        return null;
      }
      await _store.setSessionUser(refreshed);
      return refreshed;
    } on ApiException catch (err) {
      if (err.statusCode == 401 || err.statusCode == 403) {
        await _clearSession();
        return null;
      }
      // Network blip: keep cached farmer session offline-capable.
      return user;
    }
  }

  Future<void> logout() async {
    if (usesRemoteAuth && _api.accessToken != null) {
      try {
        await _api.post('/api/auth/logout', body: {});
      } catch (_) {
        // Ignore logout transport errors; clear local session anyway.
      }
    }
    try {
      await _googleSignIn.signOut();
    } catch (_) {}
    await _clearSession();
  }

  Future<void> _clearSession() async {
    _api.accessToken = null;
    _memoryUser = null;
    _memoryToken = null;
    await _store.setAccessToken(null);
    await _store.setSessionUser(null);
  }

  Future<UserModel> updateProfile({
    required String fullName,
    required String phone,
  }) async {
    final current = await _currentUser();
    if (current == null) {
      throw ApiException('Chưa đăng nhập.');
    }

    if (!usesRemoteAuth) {
      final updated = current.copyWith(
        fullName: fullName.trim(),
        phone: phone.trim(),
      );
      await _persistSession(updated, _api.accessToken);
      return updated;
    }

    final token = _api.accessToken ?? await _store.getAccessToken();
    _api.accessToken = token;
    final payload = await _api.patch(
      '/api/auth/profile',
      body: {'fullName': fullName.trim(), 'phone': phone.trim()},
    );
    final updated = UserModel.fromJson(payload);
    await _persistSession(updated, token);
    return updated;
  }

  Future<UserModel?> _currentUser() async {
    return _memoryUser ?? await _store.getSessionUser();
  }

  Future<void> changePassword(String oldPassword, String newPassword) async {
    if (newPassword.trim().length < 6) {
      throw ApiException('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    if (!usesRemoteAuth) {
      final expected = await _store.getPassword();
      if (oldPassword != expected) {
        throw ApiException('Mật khẩu cũ không đúng.');
      }
      await _store.setPassword(newPassword.trim());
      return;
    }

    final token = _api.accessToken ?? await _store.getAccessToken();
    _api.accessToken = token;
    await _api.post(
      '/api/auth/change-password',
      body: {
        'oldPassword': oldPassword,
        'newPassword': newPassword.trim(),
      },
    );
  }
}

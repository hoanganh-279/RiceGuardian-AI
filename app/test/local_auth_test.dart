import 'package:app_riceguardianai/services/api_client.dart';
import 'package:app_riceguardianai/services/auth_service.dart';
import 'package:app_riceguardianai/services/app_exception.dart';
import 'package:app_riceguardianai/services/local_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('local login succeeds with demo credentials when API unset', () async {
    final store = LocalStore();
    final auth = AuthService(store: store, api: ApiClient(baseUrl: ''));

    final user = await auth.login(LocalStore.demoPhone, LocalStore.demoPassword);

    expect(user.role, 'farmer');
    expect(user.phone, LocalStore.demoPhone);
    expect(user.fullName, LocalStore.demoFarmerName);
    expect(await auth.restoreSession(), isNotNull);
  });

  test('local login rejects wrong password', () async {
    final auth = AuthService(store: LocalStore(), api: ApiClient(baseUrl: ''));

    expect(
      () => auth.login(LocalStore.demoPhone, 'wrong'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          'Số điện thoại hoặc mật khẩu không đúng.',
        ),
      ),
    );
  });

  test('remote login stores JWT and rejects non-farmer', () async {
    final mock = MockClient((request) async {
      expect(request.url.path, '/api/auth/login');
      return http.Response(
        '{"access_token":"tok","user":{"id":"u1","fullName":"A","email":"a@b.c","phone":"0901234567","role":"admin","organizationIds":[]}}',
        200,
        headers: {'Content-Type': 'application/json'},
      );
    });
    final auth = AuthService(
      store: LocalStore(),
      api: ApiClient(baseUrl: 'http://example.test', httpClient: mock),
    );

    expect(
      () => auth.login('0901234567', 'Demo@123'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          'Tài khoản này không dùng được trên app nông dân.',
        ),
      ),
    );
  });

  test('remote farmer login persists token', () async {
    final mock = MockClient((request) async {
      return http.Response(
        '{"access_token":"jwt-farmer","user":{"id":"22222222-2222-4222-8222-222222222004","fullName":"Pham Van Dat","email":"farmer@demo.vn","phone":"0901234567","role":"farmer","organizationIds":["11111111-1111-4111-8111-111111111003"]}}',
        200,
        headers: {'Content-Type': 'application/json'},
      );
    });
    final store = LocalStore();
    final auth = AuthService(
      store: store,
      api: ApiClient(baseUrl: 'http://example.test', httpClient: mock),
    );

    final user = await auth.login('0901234567', 'Demo@123');
    expect(user.role, 'farmer');
    expect(await store.getAccessToken(), 'jwt-farmer');
  });

  test('remember me off keeps token out of prefs', () async {
    final mock = MockClient((request) async {
      return http.Response(
        '{"access_token":"jwt-temp","user":{"id":"22222222-2222-4222-8222-222222222004","fullName":"Pham Van Dat","email":"farmer@demo.vn","phone":"0901234567","role":"farmer","organizationIds":[]}}',
        200,
        headers: {'Content-Type': 'application/json'},
      );
    });
    final store = LocalStore();
    await store.setRememberMe(false);
    final auth = AuthService(
      store: store,
      api: ApiClient(baseUrl: 'http://example.test', httpClient: mock),
    );

    await auth.login('0901234567', 'Demo@123');
    expect(await store.getAccessToken(), isNull);
    expect(await store.getSessionUser(), isNull);
    expect(await auth.restoreSession(), isNotNull);
  });

  test('seeded fields are available offline', () async {
    final store = LocalStore();
    await store.ensureSeeded();
    final fields = await store.getFields();
    expect(fields.length, greaterThanOrEqualTo(3));
  });
}

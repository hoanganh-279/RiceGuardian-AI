import 'package:app_riceguardianai/app.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('App shows splash then login', (WidgetTester tester) async {
    await tester.pumpWidget(const RiceGuardianApp());
    await tester.pump();
    // Splash brand title
    expect(find.text('RICEGUARDIAN AI'), findsOneWidget);

    // Wait for splash redirect (1.8s) + settle
    await tester.pump(const Duration(milliseconds: 2000));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.text('RiceGuardian AI'), findsOneWidget);
    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.textContaining('Demo'), findsOneWidget);
  });
}

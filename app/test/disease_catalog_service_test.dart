import 'package:flutter_test/flutter_test.dart';
import 'package:app_riceguardianai/data/disease_code_map.dart';
import 'package:app_riceguardianai/services/disease_catalog_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('DiseaseCatalogService', () {
    setUp(() async {
      // Reset via fresh load (service is singleton; load is idempotent).
      await DiseaseCatalogService.instance.load();
    });

    test('loads 9 diseases from assets', () {
      expect(DiseaseCatalogService.instance.entries.length, 9);
      expect(DiseaseCatalogService.instance.isLoaded, isTrue);
    });

    test('lookupByNameVi finds Đạo ôn lá', () {
      final entry =
          DiseaseCatalogService.instance.lookupByNameVi('Đạo ôn lá');
      expect(entry, isNotNull);
      expect(entry!.code, 'Rice__LeafBlast');
      expect(entry.actions, isNotEmpty);
    });

    test('lookupByCode finds Healthy', () {
      final entry =
          DiseaseCatalogService.instance.lookupByCode('Rice__Healthy');
      expect(entry, isNotNull);
      expect(entry!.isHealthy, isTrue);
    });
  });

  group('disease_code_map', () {
    test('maps Vietnamese labels', () {
      expect(diseaseCodeForNameVi('Bạc lá'), 'Rice__BacterialLeafBlight');
      expect(diseaseCodeForNameVi('Đạo ôn cổ bông'), 'Rice__NeckBlast');
    });
  });
}

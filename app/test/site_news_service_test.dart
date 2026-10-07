import 'dart:io';

import 'package:app_riceguardianai/models/article_model.dart';
import 'package:app_riceguardianai/services/site_news_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses bundled site news JSON', () async {
    final service = SiteNewsService(
      loader: () => File(SiteNewsService.assetPath).readAsString(),
    );
    final items = await service.loadAll();

    expect(items, isNotEmpty);
    for (final a in items) {
      expect(a.isSiteNews, isTrue);
      expect(a.category, ArticleModel.siteCategory);
      expect(a.title, isNotEmpty);
      expect(a.sourceName, isNotEmpty);
      expect(a.sections, isNotEmpty);
      if (a.coverAsset != null) {
        expect(File(a.coverAsset!).existsSync(), isTrue, reason: a.coverAsset);
      }
      for (final s in a.sections.where((s) => s.type == 'figure')) {
        expect(File(s.asset!).existsSync(), isTrue, reason: s.asset);
      }
    }

    final first = items.first;
    expect(await service.findById(first.id), same(first));
    expect(await service.findById('site-khong-ton-tai'), isNull);
  });

  test('merge sorts site and remote articles by date desc', () {
    ArticleModel make(String id, String? date) => ArticleModel(
          id: id,
          title: id,
          summary: '',
          category: 'ky_thuat',
          status: 'published',
          publishedAt: date,
        );

    final merged = SiteNewsService.merge(
      [make('site-a', '2026-09-03'), make('site-b', '2026-09-08')],
      [make('1', '2026-09-05T10:00:00Z'), make('2', null)],
    );

    expect(merged.map((a) => a.id), ['site-b', '1', 'site-a', '2']);
  });
}

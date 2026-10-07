import 'dart:convert';

import 'package:flutter/services.dart';

import '../models/article_model.dart';

/// Bản tin thị trường lúa gạo đóng gói từ website giới thiệu (`site/`).
class SiteNewsService {
  SiteNewsService({Future<String> Function()? loader})
      : _loader = loader ?? (() => rootBundle.loadString(assetPath));

  static const assetPath = 'assets/news/site_news.json';

  static final SiteNewsService instance = SiteNewsService();

  final Future<String> Function() _loader;
  List<ArticleModel>? _cache;

  Future<List<ArticleModel>> loadAll() async {
    final cached = _cache;
    if (cached != null) return cached;
    final raw = jsonDecode(await _loader());
    final items = <ArticleModel>[];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map) {
          items.add(ArticleModel.fromSiteJson(Map<String, dynamic>.from(item)));
        }
      }
    }
    _cache = sortByDateDesc(items);
    return _cache!;
  }

  Future<ArticleModel?> findById(String id) async {
    for (final article in await loadAll()) {
      if (article.id == id) return article;
    }
    return null;
  }

  static List<ArticleModel> merge(
    List<ArticleModel> site,
    List<ArticleModel> remote,
  ) =>
      sortByDateDesc([...site, ...remote]);

  static List<ArticleModel> sortByDateDesc(List<ArticleModel> items) {
    final sorted = [...items];
    sorted.sort((a, b) {
      final da = DateTime.tryParse(a.publishedAt ?? '');
      final db = DateTime.tryParse(b.publishedAt ?? '');
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return db.compareTo(da);
    });
    return sorted;
  }
}

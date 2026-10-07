class ArticleModel {
  ArticleModel({
    required this.id,
    required this.title,
    required this.summary,
    required this.category,
    required this.status,
    this.coverUrl,
    this.body = '',
    this.publishedAt,
    this.authorName = '',
    this.publicFaq = const [],
    this.coverAsset,
    this.coverCaption = '',
    this.coverCredit = '',
    this.sourceName = '',
    this.sourceAuthor = '',
    this.sourceUrl = '',
    this.sections = const [],
  });

  static const siteIdPrefix = 'site-';
  static const siteCategory = 'thi_truong';
  static const siteAssetDir = 'assets/news/';

  final String id;
  final String title;
  final String summary;
  final String category;
  final String status;
  final String? coverUrl;
  final String body;
  final String? publishedAt;
  final String authorName;
  final List<ArticleQuestionModel> publicFaq;
  final String? coverAsset;
  final String coverCaption;
  final String coverCredit;
  final String sourceName;
  final String sourceAuthor;
  final String sourceUrl;
  final List<SiteNewsSection> sections;

  static const categoryLabels = {
    'ky_thuat': 'Kỹ thuật',
    'canh_bao': 'Cảnh báo',
    'he_thong': 'Hệ thống',
    siteCategory: 'Thị trường',
  };

  String get categoryLabel => categoryLabels[category] ?? category;

  bool get isSiteNews => id.startsWith(siteIdPrefix);

  /// Bản tin tĩnh xuất từ `site/src/data/news.js` (`assets/news/site_news.json`).
  factory ArticleModel.fromSiteJson(Map<String, dynamic> json) {
    final source = json['source'] is Map
        ? Map<String, dynamic>.from(json['source'] as Map)
        : const <String, dynamic>{};
    final cover = json['cover'] is Map
        ? Map<String, dynamic>.from(json['cover'] as Map)
        : null;
    final coverFile = cover?['src'] as String?;
    final sections = <SiteNewsSection>[];
    final rawSections = json['sections'];
    if (rawSections is List) {
      for (final item in rawSections) {
        if (item is Map) {
          sections.add(SiteNewsSection.fromJson(Map<String, dynamic>.from(item)));
        }
      }
    }
    return ArticleModel(
      id: '$siteIdPrefix${json['slug'] ?? ''}',
      title: json['title'] as String? ?? '',
      summary: json['excerpt'] as String? ?? '',
      category: siteCategory,
      status: 'published',
      publishedAt: json['date'] as String?,
      coverAsset: coverFile == null || coverFile.isEmpty
          ? null
          : '$siteAssetDir$coverFile',
      coverCaption: cover?['caption'] as String? ?? '',
      coverCredit: cover?['credit'] as String? ?? '',
      sourceName: source['name'] as String? ?? '',
      sourceAuthor: source['author'] as String? ?? '',
      sourceUrl: source['url'] as String? ?? '',
      sections: sections,
    );
  }

  factory ArticleModel.fromJson(Map<String, dynamic> json) {
    final faqRaw = json['publicFaq'];
    final faq = <ArticleQuestionModel>[];
    if (faqRaw is List) {
      for (final item in faqRaw) {
        if (item is Map) {
          faq.add(ArticleQuestionModel.fromJson(Map<String, dynamic>.from(item)));
        }
      }
    }
    return ArticleModel(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      category: json['category'] as String? ?? 'ky_thuat',
      status: json['status'] as String? ?? '',
      coverUrl: json['coverUrl'] as String?,
      body: json['body'] as String? ?? '',
      publishedAt: json['publishedAt'] as String?,
      authorName: json['authorName'] as String? ?? '',
      publicFaq: faq,
    );
  }
}

class ArticleQuestionModel {
  ArticleQuestionModel({
    required this.id,
    required this.articleId,
    required this.body,
    required this.status,
    this.articleTitle = '',
    this.farmerName = '',
    this.answerBody = '',
    this.answeredByName = '',
    this.answeredAt,
    this.createdAt = '',
    this.isPublic = false,
  });

  final String id;
  final String articleId;
  final String articleTitle;
  final String body;
  final String status;
  final String farmerName;
  final String answerBody;
  final String answeredByName;
  final String? answeredAt;
  final String createdAt;
  final bool isPublic;

  factory ArticleQuestionModel.fromJson(Map<String, dynamic> json) {
    return ArticleQuestionModel(
      id: json['id']?.toString() ?? '',
      articleId: json['articleId']?.toString() ?? '',
      articleTitle: json['articleTitle'] as String? ?? '',
      body: json['body'] as String? ?? '',
      status: json['status'] as String? ?? 'open',
      farmerName: json['farmerName'] as String? ?? '',
      answerBody: json['answerBody'] as String? ?? '',
      answeredByName: json['answeredByName'] as String? ?? '',
      answeredAt: json['answeredAt'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      isPublic: json['isPublic'] as bool? ?? false,
    );
  }
}

/// Một khối nội dung bản tin site: `text` | `prices` | `quote` | `figure`.
class SiteNewsSection {
  SiteNewsSection({
    required this.type,
    this.heading = '',
    this.paragraphs = const [],
    this.title = '',
    this.rows = const [],
    this.note = '',
    this.text = '',
    this.attribution = '',
    this.asset,
    this.alt = '',
    this.caption = '',
    this.credit = '',
  });

  final String type;
  final String heading;
  final List<String> paragraphs;
  final String title;
  final List<SiteNewsPriceRow> rows;
  final String note;
  final String text;
  final String attribution;
  final String? asset;
  final String alt;
  final String caption;
  final String credit;

  factory SiteNewsSection.fromJson(Map<String, dynamic> json) {
    final paragraphs = json['paragraphs'] is List
        ? (json['paragraphs'] as List).map((e) => e.toString()).toList()
        : const <String>[];
    final rows = json['rows'] is List
        ? (json['rows'] as List)
            .whereType<Map>()
            .map((e) => SiteNewsPriceRow.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : const <SiteNewsPriceRow>[];
    final src = json['src'] as String?;
    return SiteNewsSection(
      type: json['type'] as String? ?? 'text',
      heading: json['heading'] as String? ?? '',
      paragraphs: paragraphs,
      title: json['title'] as String? ?? '',
      rows: rows,
      note: json['note'] as String? ?? '',
      text: json['text'] as String? ?? '',
      attribution: json['attribution'] as String? ?? '',
      asset: src == null || src.isEmpty
          ? null
          : '${ArticleModel.siteAssetDir}$src',
      alt: json['alt'] as String? ?? '',
      caption: json['caption'] as String? ?? '',
      credit: json['credit'] as String? ?? '',
    );
  }
}

class SiteNewsPriceRow {
  SiteNewsPriceRow({required this.label, required this.value, this.note = ''});

  final String label;
  final String value;
  final String note;

  factory SiteNewsPriceRow.fromJson(Map<String, dynamic> json) {
    return SiteNewsPriceRow(
      label: json['label'] as String? ?? '',
      value: json['value'] as String? ?? '',
      note: json['note'] as String? ?? '',
    );
  }
}

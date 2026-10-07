import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../config/app_colors.dart';
import '../../models/article_model.dart';
import '../../utils/date_display.dart';
import '../../widgets/rice/rice.dart';

/// Nội dung chi tiết bản tin tóm tắt từ website giới thiệu (có trích nguồn).
class SiteNewsBody extends StatelessWidget {
  const SiteNewsBody({super.key, required this.article});

  final ArticleModel article;

  @override
  Widget build(BuildContext context) {
    final meta = [
      if (article.sourceName.isNotEmpty) article.sourceName,
      if (article.publishedAt != null) formatDate(article.publishedAt!),
    ].join(' · ');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (article.coverAsset != null) ...[
          _Figure(
            asset: article.coverAsset!,
            caption: article.coverCaption,
            credit: article.coverCredit,
            height: 200,
          ),
          const SizedBox(height: 16),
        ],
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              article.categoryLabel,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          article.title,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
        ),
        if (meta.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            meta,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ],
        if (article.summary.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            article.summary,
            style: const TextStyle(
              fontSize: 15,
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
        for (final section in article.sections) ...[
          const SizedBox(height: 16),
          _Section(section: section),
        ],
        const SizedBox(height: 20),
        _SourceCard(article: article),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.section});

  final SiteNewsSection section;

  @override
  Widget build(BuildContext context) {
    switch (section.type) {
      case 'prices':
        return _PriceTable(section: section);
      case 'quote':
        return _Quote(section: section);
      case 'figure':
        if (section.asset == null) return const SizedBox.shrink();
        return _Figure(
          asset: section.asset!,
          caption: section.caption,
          credit: section.credit,
        );
      default:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (section.heading.isNotEmpty) ...[
              Text(
                section.heading,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
            ],
            for (var i = 0; i < section.paragraphs.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              Text(
                section.paragraphs[i],
                style: const TextStyle(fontSize: 15, height: 1.55),
              ),
            ],
          ],
        );
    }
  }
}

class _PriceTable extends StatelessWidget {
  const _PriceTable({required this.section});

  final SiteNewsSection section;

  @override
  Widget build(BuildContext context) {
    return RiceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (section.title.isNotEmpty) ...[
            Text(
              section.title,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
          ],
          for (var i = 0; i < section.rows.length; i++) ...[
            if (i > 0) const Divider(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    section.rows[i].label,
                    style: const TextStyle(fontSize: 14, height: 1.35),
                  ),
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        section.rows[i].value,
                        textAlign: TextAlign.end,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                      if (section.rows[i].note.isNotEmpty)
                        Text(
                          section.rows[i].note,
                          textAlign: TextAlign.end,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ],
          if (section.note.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              section.note,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Quote extends StatelessWidget {
  const _Quote({required this.section});

  final SiteNewsSection section;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        border: const Border(
          left: BorderSide(color: AppColors.primary, width: 4),
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '“${section.text}”',
            style: const TextStyle(
              fontSize: 15,
              height: 1.5,
              fontStyle: FontStyle.italic,
            ),
          ),
          if (section.attribution.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '— ${section.attribution}',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({
    required this.asset,
    this.caption = '',
    this.credit = '',
    this.height,
  });

  final String asset;
  final String caption;
  final String credit;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final footer = [caption, credit].where((s) => s.isNotEmpty).join(' ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Image.asset(
            asset,
            height: height,
            width: double.infinity,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
          ),
        ),
        if (footer.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            footer,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ],
    );
  }
}

class _SourceCard extends StatelessWidget {
  const _SourceCard({required this.article});

  final ArticleModel article;

  @override
  Widget build(BuildContext context) {
    final byline = [
      if (article.sourceName.isNotEmpty) article.sourceName,
      if (article.sourceAuthor.isNotEmpty) article.sourceAuthor,
    ].join(' — ');
    return RiceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Nguồn',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          const Text(
            'Bài tóm tắt có trích nguồn, không phải tin do RiceGuardian biên tập gốc.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          if (byline.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(byline, style: const TextStyle(fontSize: 14)),
          ],
          if (article.sourceUrl.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: SelectableText(
                    article.sourceUrl,
                    style: const TextStyle(fontSize: 13, color: AppColors.primary),
                  ),
                ),
                IconButton(
                  tooltip: 'Sao chép liên kết',
                  icon: const Icon(Icons.copy_rounded, size: 20),
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(text: article.sourceUrl),
                    );
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Đã sao chép liên kết bài gốc.')),
                    );
                  },
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

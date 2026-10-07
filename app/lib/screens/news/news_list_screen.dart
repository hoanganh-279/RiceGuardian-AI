import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/article_model.dart';
import '../../providers/app_providers.dart';
import '../../services/app_exception.dart';
import '../../services/site_news_service.dart';
import '../../widgets/rice/rice.dart';

class NewsListScreen extends StatefulWidget {
  const NewsListScreen({super.key});

  @override
  State<NewsListScreen> createState() => _NewsListScreenState();
}

class _NewsListScreenState extends State<NewsListScreen> {
  String _category = '';
  List<ArticleModel> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final data = context.read<AppDataProvider>();
    final category = _category;
    final includeSite =
        category.isEmpty || category == ArticleModel.siteCategory;
    final includeRemote =
        data.usesRemote && category != ArticleModel.siteCategory;
    setState(() {
      _loading = true;
      _error = null;
    });

    var site = <ArticleModel>[];
    var remote = <ArticleModel>[];
    String? error;
    if (includeSite) {
      try {
        site = await SiteNewsService.instance.loadAll();
      } catch (e) {
        error = e.toString();
      }
    }
    if (includeRemote) {
      try {
        remote = await data.remote.fetchArticles(category: category);
      } catch (e) {
        error = e is ApiException ? e.message : e.toString();
      }
    } else if (!data.usesRemote && category != ArticleModel.siteCategory) {
      error = 'Cần kết nối mạng để xem bản tin.';
    }

    if (!mounted || category != _category) return;
    setState(() {
      _items = SiteNewsService.merge(site, remote);
      _error = error;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bản tin')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: RiceFilterChips<String>(
              options: [
                const ChoiceOption(value: '', label: 'Tất cả'),
                for (final e in ArticleModel.categoryLabels.entries)
                  ChoiceOption(value: e.key, label: e.value),
              ],
              selected: _category,
              onSelected: (v) {
                setState(() => _category = v);
                _load();
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: _loading
                  ? ListView(
                      padding: const EdgeInsets.all(16),
                      children: [RiceSkeleton.list(count: 4, height: 88)],
                    )
                  : _error != null && _items.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(
                              height: MediaQuery.sizeOf(context).height * 0.5,
                              child: RiceEmptyState(
                                message: _error!,
                                icon: Icons.wifi_off_outlined,
                              ),
                            ),
                          ],
                        )
                      : _items.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: const [
                                SizedBox(height: 120),
                                RiceEmptyState(
                                  message: 'Chưa có bản tin.',
                                  icon: Icons.newspaper_outlined,
                                ),
                              ],
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _items.length,
                              itemBuilder: (context, index) {
                                final article = _items[index];
                                final placeholder = Container(
                                  width: 64,
                                  height: 64,
                                  color: AppColors.primary
                                      .withValues(alpha: 0.12),
                                  child: const Icon(
                                    Icons.newspaper_outlined,
                                    color: AppColors.primary,
                                  ),
                                );
                                return RiceCard(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  onTap: () =>
                                      context.push('/news/${article.id}'),
                                  child: Row(
                                    children: [
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(12),
                                        child: article.coverAsset != null
                                            ? Image.asset(
                                                article.coverAsset!,
                                                width: 64,
                                                height: 64,
                                                fit: BoxFit.cover,
                                                errorBuilder: (_, __, ___) =>
                                                    placeholder,
                                              )
                                            : article.coverUrl != null
                                                ? Image.network(
                                                    article.coverUrl!,
                                                    width: 64,
                                                    height: 64,
                                                    fit: BoxFit.cover,
                                                    errorBuilder:
                                                        (_, __, ___) =>
                                                            placeholder,
                                                  )
                                                : placeholder,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              article.sourceName.isNotEmpty
                                                  ? '${article.categoryLabel} · ${article.sourceName}'
                                                  : article.categoryLabel,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: AppColors.textSecondary,
                                              ),
                                            ),
                                            Text(
                                              article.title,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 15,
                                              ),
                                            ),
                                            if (article.summary.isNotEmpty)
                                              Text(
                                                article.summary,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 13,
                                                  color:
                                                      AppColors.textSecondary,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                      const Icon(
                                        Icons.chevron_right,
                                        color: AppColors.textSecondary,
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }
}
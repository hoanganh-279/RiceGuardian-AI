import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/article_model.dart';
import '../../providers/app_providers.dart';
import '../../services/app_exception.dart';
import '../../services/site_news_service.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/rice/rice.dart';
import 'site_news_body.dart';

class ArticleDetailScreen extends StatefulWidget {
  const ArticleDetailScreen({super.key, required this.articleId});

  final String articleId;

  @override
  State<ArticleDetailScreen> createState() => _ArticleDetailScreenState();
}

class _ArticleDetailScreenState extends State<ArticleDetailScreen> {
  ArticleModel? _article;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (widget.articleId.startsWith(ArticleModel.siteIdPrefix)) {
      await _loadSite();
      return;
    }
    final data = context.read<AppDataProvider>();
    if (!data.usesRemote) {
      setState(() {
        _loading = false;
        _error = 'Cần kết nối mạng để đọc bản tin.';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final article = await data.remote.fetchArticle(widget.articleId);
      if (!mounted) return;
      setState(() {
        _article = article;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadSite() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final article = await SiteNewsService.instance.findById(widget.articleId);
      if (!mounted) return;
      setState(() {
        _article = article;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Không đọc được bản tin.';
        _loading = false;
      });
    }
  }

  Future<void> _askQuestion() async {
    final article = _article;
    if (article == null) return;
    final controller = TextEditingController();
    final body = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Đặt câu hỏi về bài viết',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              Text(
                article.title,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                maxLines: 5,
                maxLength: 2000,
                decoration: const InputDecoration(
                  hintText: 'Bạn muốn hỏi gì về nội dung bài này?',
                  helperText: 'Kỹ thuật viên sẽ trả lời và thông báo trên App',
                ),
              ),
              const SizedBox(height: 8),
              RicePrimaryButton(
                label: 'Gửi câu hỏi',
                onPressed: () {
                  final text = controller.text.trim();
                  if (text.length < 10) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      const SnackBar(content: Text('Câu hỏi cần ít nhất 10 ký tự.')),
                    );
                    return;
                  }
                  Navigator.pop(ctx, text);
                },
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Hủy'),
              ),
            ],
          ),
        );
      },
    );
    controller.dispose();
    if (body == null || !mounted) return;
    try {
      await context.read<AppDataProvider>().remote.askArticleQuestion(article.id, body);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi câu hỏi. Chúng tôi sẽ thông báo khi có trả lời.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiException ? e.message : e.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bản tin'),
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline),
            tooltip: 'Câu hỏi của tôi',
            onPressed: () => context.push('/my-questions'),
          ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: RiceErrorBanner(message: _error!, onRetry: _load),
                  ),
                )
              : _article == null
                  ? const RiceEmptyState(message: 'Không tìm thấy bài viết.')
                  : _article!.isSiteNews
                  ? SiteNewsBody(article: _article!)
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_article!.coverUrl != null)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: Image.network(
                              _article!.coverUrl!,
                              height: 200,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                            ),
                          ),
                        if (_article!.coverUrl != null) const SizedBox(height: 16),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              _article!.categoryLabel,
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
                          _article!.title,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (_article!.authorName.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            _article!.authorName,
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                          ),
                        ],
                        const SizedBox(height: 16),
                        Text(
                          _article!.body,
                          style: const TextStyle(fontSize: 15, height: 1.55),
                        ),
                        if (_article!.publicFaq.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          const SectionHeader(title: 'Câu hỏi thường gặp'),
                          RiceCard(
                            padding: EdgeInsets.zero,
                            child: Column(
                              children: [
                                for (var i = 0;
                                    i < _article!.publicFaq.length;
                                    i++) ...[
                                  if (i > 0) const Divider(),
                                  Theme(
                                    data: Theme.of(context).copyWith(
                                      dividerColor: Colors.transparent,
                                    ),
                                    child: ExpansionTile(
                                      title: Text(
                                        _article!.publicFaq[i].body,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      children: [
                                        Padding(
                                          padding: const EdgeInsets.fromLTRB(
                                            16,
                                            0,
                                            16,
                                            12,
                                          ),
                                          child: Align(
                                            alignment: Alignment.centerLeft,
                                            child: Text(
                                              _article!.publicFaq[i].answerBody,
                                              style: const TextStyle(
                                                fontSize: 14,
                                                color: AppColors.textSecondary,
                                                height: 1.4,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        RiceOutlinedButton(
                          label: 'Đặt câu hỏi về bài này',
                          icon: Icons.question_answer_outlined,
                          onPressed: _askQuestion,
                        ),
                      ],
                    ),
    );
  }
}

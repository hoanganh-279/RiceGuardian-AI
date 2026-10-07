import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/article_model.dart';
import '../../providers/app_providers.dart';
import '../../widgets/rice/rice.dart';

class MyQuestionsScreen extends StatefulWidget {
  const MyQuestionsScreen({super.key});

  @override
  State<MyQuestionsScreen> createState() => _MyQuestionsScreenState();
}

class _MyQuestionsScreenState extends State<MyQuestionsScreen> {
  String _status = '';
  List<ArticleQuestionModel> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final data = context.read<AppDataProvider>();
    if (!data.usesRemote) {
      setState(() {
        _loading = false;
        _error = 'Cần kết nối mạng.';
        _items = [];
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await data.remote.fetchMyQuestions(status: _status);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Câu hỏi của tôi')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: RiceFilterChips<String>(
              options: const [
                ChoiceOption(value: '', label: 'Tất cả'),
                ChoiceOption(value: 'open', label: 'Chờ trả lời'),
                ChoiceOption(value: 'answered', label: 'Đã trả lời'),
              ],
              selected: _status,
              onSelected: (v) {
                setState(() => _status = v);
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
                      children: [RiceSkeleton.list(count: 4, height: 96)],
                    )
                  : _items.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: 80),
                            RiceEmptyState(
                              message: _error ?? 'Bạn chưa hỏi bài nào.',
                              icon: Icons.forum_outlined,
                              actionLabel: 'Xem bản tin',
                              onAction: () => context.push('/news'),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _items.length,
                          itemBuilder: (context, index) {
                            final q = _items[index];
                            final waiting = q.status == 'open';
                            return RiceCard(
                              margin: const EdgeInsets.only(bottom: 12),
                              onTap: () => context.push('/my-questions/${q.id}'),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    q.articleTitle,
                                    style: const TextStyle(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    q.body,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                  const SizedBox(height: 8),
                                  StatusChip(answered: !waiting),
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

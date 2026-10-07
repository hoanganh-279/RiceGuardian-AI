import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/article_model.dart';
import '../../providers/app_providers.dart';
import '../../services/app_exception.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/rice/rice.dart';

class QuestionThreadScreen extends StatefulWidget {
  const QuestionThreadScreen({super.key, required this.questionId});

  final String questionId;

  @override
  State<QuestionThreadScreen> createState() => _QuestionThreadScreenState();
}

class _QuestionThreadScreenState extends State<QuestionThreadScreen> {
  ArticleQuestionModel? _question;
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
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final q = await data.remote.fetchMyQuestion(widget.questionId);
      if (!mounted) return;
      setState(() {
        _question = q;
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

  @override
  Widget build(BuildContext context) {
    final q = _question;
    return Scaffold(
      appBar: AppBar(title: const Text('Câu hỏi')),
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
              : q == null
                  ? const RiceEmptyState(message: 'Không tìm thấy câu hỏi.')
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        RiceCard(
                          onTap: () => context.push('/news/${q.articleId}'),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.newspaper_outlined,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  q.articleTitle,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right,
                                color: AppColors.textSecondary,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: StatusChip(answered: q.status == 'answered'),
                        ),
                        const SizedBox(height: 8),
                        ChatBubble(
                          text: q.body,
                          fromFarmer: true,
                          caption: 'Câu hỏi của bạn',
                        ),
                        if (q.status == 'answered')
                          ChatBubble(
                            text: q.answerBody,
                            fromFarmer: false,
                            caption:
                                'Trả lời từ ${q.answeredByName.isEmpty ? 'kỹ thuật viên' : q.answeredByName}',
                          ),
                      ],
                    ),
    );
  }
}

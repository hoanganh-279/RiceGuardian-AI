import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/notification_model.dart';
import '../../providers/app_providers.dart';
import '../../utils/date_display.dart';
import '../../widgets/rice/rice.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppDataProvider>().refreshNotifications();
    });
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'treatment':
        return Icons.medical_services_outlined;
      case 'alert':
        return Icons.warning_amber_rounded;
      case 'article_reply':
        return Icons.question_answer_outlined;
      default:
        return Icons.info_outline;
    }
  }

  Color _colorFor(String type) {
    switch (type) {
      case 'treatment':
      case 'article_reply':
        return AppColors.primary;
      case 'alert':
        return AppColors.danger;
      default:
        return AppColors.secondary;
    }
  }

  List<MapEntry<String, List<NotificationModel>>> _groupByDate(
    List<NotificationModel> items,
  ) {
    final groups = <String, List<NotificationModel>>{};
    for (final n in items) {
      groups.putIfAbsent(dateGroupLabel(n.createdAt), () => []).add(n);
    }
    return groups.entries.toList();
  }

  List<String> _parseSteps(String body) {
    final lines = body
        .split(RegExp(r'[\n\r]+'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    final steps = <String>[];
    for (final line in lines) {
      final numbered = RegExp(r'^\d+[\.\)]\s*(.+)$').firstMatch(line);
      final bullet = RegExp(r'^[-•*]\s*(.+)$').firstMatch(line);
      if (numbered != null) {
        steps.add(numbered.group(1)!);
      } else if (bullet != null) {
        steps.add(bullet.group(1)!);
      }
    }
    return steps;
  }

  void _openDetail(String title, String body, String type) {
    final steps = type == 'treatment' ? _parseSteps(body) : const <String>[];
    showInfoDialog(
      context,
      title: title,
      icon: _iconFor(type),
      content: steps.isNotEmpty
          ? DiseaseActionList(actions: steps, title: 'Các bước xử lý')
          : Text(body, style: const TextStyle(fontSize: 15, height: 1.4)),
    );
  }

  Widget _item(NotificationModel item) {
    final color = _colorFor(item.type);
    final isTreatment = item.type == 'treatment';
    return RiceCard(
      margin: const EdgeInsets.only(bottom: 12),
      onTap: () {
        if (!item.read) {
          context.read<AppDataProvider>().markNotificationRead(item.id);
        }
        if (item.type == 'article_reply' &&
            (item.relatedQuestionId?.isNotEmpty ?? false)) {
          context.push('/my-questions/${item.relatedQuestionId}');
          return;
        }
        _openDetail(item.title, item.body, item.type);
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: color.withValues(alpha: 0.15),
            child: Icon(_iconFor(item.type), color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: TextStyle(
                    fontWeight: item.read ? FontWeight.w500 : FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.body,
                  maxLines: isTreatment ? 4 : 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  formatDateTime(item.createdAt),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (!item.read)
            Container(
              margin: const EdgeInsets.only(left: 8, top: 6),
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AppDataProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Thông báo')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          await data.refreshNotifications();
          await data.flushPendingUploads();
        },
        child: data.notifications.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 80),
                  RiceEmptyState(
                    message: 'Chưa có thông báo.',
                    icon: Icons.mark_email_unread_outlined,
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  for (final entry in _groupByDate(data.notifications)) ...[
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8, top: 4),
                      child: Text(
                        entry.key,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    for (final item in entry.value) _item(item),
                  ],
                ],
              ),
      ),
    );
  }
}

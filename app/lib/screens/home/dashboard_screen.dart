import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../constants/alert_labels.dart';
import '../../models/alert_model.dart';
import '../../models/article_model.dart';
import '../../providers/app_providers.dart';
import '../../utils/metric_display.dart';
import '../../widgets/alert_badge.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/rice/rice.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final data = context.read<AppDataProvider>();
      if (data.fields.isEmpty) {
        data.refreshDashboard();
      } else {
        data.refreshArticles();
      }
    });
  }

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return 'ND';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) {
      final s = parts.first;
      return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
    }
    final a = parts.first.isNotEmpty ? parts.first[0] : '';
    final b = parts.last.isNotEmpty ? parts.last[0] : '';
    return ('$a$b').toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AppDataProvider>();
    final auth = context.watch<AuthProvider>();
    final name = auth.user?.fullName ?? 'Nông dân';
    final initialLoading =
        data.loading && data.latestAlerts.isEmpty && data.fields.isEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Trang chủ'),
        actions: [
          IconButton(
            tooltip: 'Thông báo',
            icon: Badge(
              backgroundColor: AppColors.secondary,
              textColor: AppColors.textPrimary,
              label: const Text(metricDash),
              child: const Icon(Icons.notifications_outlined),
            ),
            onPressed: () => context.push('/notifications'),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: data.refreshDashboard,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            _Greeting(initials: _initials(name), name: name),
            const SizedBox(height: 16),
            if (data.error != null &&
                data.latestAlerts.isEmpty &&
                data.fields.isEmpty) ...[
              RiceErrorBanner(
                message: errorMessage(Exception(data.error)),
                onRetry: data.refreshDashboard,
              ),
              const SizedBox(height: 16),
            ],

            const SectionHeader(title: 'Thống kê của bạn'),
            Row(
              children: [
                Expanded(
                  child: _KpiCard(
                    icon: Icons.grass,
                    label: 'Thửa',
                    color: AppColors.primary,
                    onTap: () => context.go('/fields'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _KpiCard(
                    icon: Icons.notifications_active_outlined,
                    label: 'Chưa đọc',
                    color: AppColors.secondary,
                    onTap: () => context.push('/notifications'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _KpiCard(
                    icon: Icons.warning_amber_rounded,
                    label: 'Cảnh báo',
                    color: AppColors.danger,
                    onTap: () => context.go('/alerts'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            RicePrimaryButton(
              label: 'Chụp ảnh kiểm bệnh',
              icon: Icons.photo_camera_rounded,
              onPressed: () => context.go('/camera'),
            ),
            const SizedBox(height: 16),

            SectionHeader(
              title: 'Cảnh báo mới nhất',
              onAction: () => context.go('/alerts'),
            ),
            if (initialLoading)
              RiceSkeleton.list(count: 2, height: 96)
            else if (data.latestAlerts.isEmpty)
              const RiceCard(
                child: RiceEmptyState(
                  message: 'Chưa có cảnh báo mới. Ruộng đang ổn!',
                  icon: Icons.eco_outlined,
                ),
              )
            else
              for (final alert in data.latestAlerts) _AlertCard(alert: alert),
            const SizedBox(height: 16),

            SectionHeader(
              title: 'Bản tin mới nhất',
              onAction: () => context.push('/news'),
            ),
            if (data.latestArticles.isEmpty)
              const RiceCard(
                child: RiceEmptyState(
                  message: 'Chưa có bản tin.',
                  icon: Icons.newspaper_outlined,
                ),
              )
            else
              SizedBox(
                height: 200,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: data.latestArticles.length.clamp(0, 8),
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, index) =>
                      _ArticleCard(article: data.latestArticles[index]),
                ),
              ),
            const SizedBox(height: 16),

            const SectionHeader(title: 'Sản phẩm RiceGuardian'),
            const _ProductCard(),
            const SizedBox(height: 16),

            RiceOutlinedButton(
              label: 'Lịch sử ảnh đã chụp',
              icon: Icons.photo_library_outlined,
              onPressed: () => context.push('/photos'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.initials, required this.name});

  final String initials;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 26,
          backgroundColor: AppColors.primary.withValues(alpha: 0.12),
          child: Text(
            initials,
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Xin chào,',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              Text(
                name,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return RiceCard(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
      onTap: onTap,
      child: Column(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 6),
          const Text(
            metricDash,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert});

  final AlertModel alert;

  @override
  Widget build(BuildContext context) {
    final isEnv = alert.type == 'environment';
    return RiceCard(
      margin: const EdgeInsets.only(bottom: 12),
      onTap: () => context.go('/alerts'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  alert.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              AlertBadge(riskLevel: alert.riskLevel),
            ],
          ),
          const SizedBox(height: 8),
          AlertTypeChip(isEnvironment: isEnv),
          const SizedBox(height: 8),
          Text(
            '${alert.fieldName}\n${alert.summary}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              height: 1.35,
            ),
          ),
          if (isEnv) ...[
            const SizedBox(height: 4),
            Text(
              kAlertTypeHint['environment']!,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ArticleCard extends StatelessWidget {
  const _ArticleCard({required this.article});

  final ArticleModel article;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      height: 100,
      color: AppColors.primary.withValues(alpha: 0.12),
      child: const Center(
        child: Icon(Icons.newspaper_outlined, color: AppColors.primary),
      ),
    );
    return SizedBox(
      width: 240,
      child: RiceCard(
        padding: EdgeInsets.zero,
        onTap: () => context.push('/news/${article.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
              child: article.coverAsset != null
                  ? Image.asset(
                      article.coverAsset!,
                      height: 100,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => placeholder,
                    )
                  : article.coverUrl != null
                      ? Image.network(
                          article.coverUrl!,
                          height: 100,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => placeholder,
                        )
                      : placeholder,
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
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
                  const SizedBox(height: 2),
                  Text(
                    article.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard();

  @override
  Widget build(BuildContext context) {
    return RiceCard(
      padding: EdgeInsets.zero,
      onTap: () => context.push('/product'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Image.asset(
              'img/monitoring_station.png',
              height: 180,
              width: double.infinity,
              fit: BoxFit.contain,
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Trạm giám sát RiceGuardian AI',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                SizedBox(height: 6),
                Text(
                  'Trạm IoT cấp nguồn mặt trời, đo vi khí hậu phục vụ cảnh báo sớm bệnh lúa trên App.',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 8, bottom: 8),
            child: TextButton.icon(
              onPressed: () => context.push('/product'),
              iconAlignment: IconAlignment.end,
              icon: const Icon(Icons.chevron_right, size: 20),
              label: const Text('Xem chi tiết'),
            ),
          ),
        ],
      ),
    );
  }
}

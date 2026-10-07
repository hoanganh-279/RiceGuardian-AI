import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/alert_model.dart';
import '../../models/field_model.dart';
import '../../providers/app_providers.dart';
import '../../utils/metric_display.dart';
import '../../widgets/alert_badge.dart';
import '../../widgets/rice/rice.dart';

const _riskOrder = {'high': 3, 'medium': 2, 'low': 1};

/// Alerts belonging to [field] (matched by name — alerts carry no field id).
List<AlertModel> alertsForField(List<AlertModel> alerts, FieldModel field) =>
    alerts.where((a) => a.fieldName == field.name).toList();

/// Highest risk level among [alerts], or null when empty.
String? highestRisk(List<AlertModel> alerts) {
  String? best;
  for (final a in alerts) {
    if (best == null || (_riskOrder[a.riskLevel] ?? 0) > (_riskOrder[best] ?? 0)) {
      best = a.riskLevel;
    }
  }
  return best;
}

/// Short code for a field placeholder, e.g. "Thửa kênh 8 — đầu bờ" -> "K8".
String fieldInitials(String name) {
  var core = name.split(RegExp(r'\s+[—–-]\s+')).first.trim();
  core = core.replaceFirst(RegExp(r'^thửa\s+', caseSensitive: false), '');
  final tokens = core.split(RegExp(r'\s+')).where((t) => t.isNotEmpty);
  final buf = StringBuffer();
  for (final t in tokens) {
    buf.write(RegExp(r'\d').hasMatch(t) ? t : t.characters.first);
  }
  final code = buf.toString().toUpperCase();
  if (code.isEmpty) {
    return name.trim().isEmpty ? '?' : name.trim().characters.first.toUpperCase();
  }
  return code.length > 3 ? code.substring(0, 3) : code;
}

class FieldsListScreen extends StatefulWidget {
  const FieldsListScreen({super.key});

  @override
  State<FieldsListScreen> createState() => _FieldsListScreenState();
}

class _FieldsListScreenState extends State<FieldsListScreen> {
  late bool _loading;

  @override
  void initState() {
    super.initState();
    final data = context.read<AppDataProvider>();
    _loading = data.fields.isEmpty;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final data = context.read<AppDataProvider>();
      await Future.wait([
        if (data.fields.isEmpty) data.refreshFields(),
        if (data.alerts.isEmpty) data.refreshAlerts(),
      ]);
      if (mounted) setState(() => _loading = false);
    });
  }

  Future<void> _refresh() async {
    final data = context.read<AppDataProvider>();
    await Future.wait([data.refreshFields(), data.refreshAlerts()]);
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AppDataProvider>();
    final fields = data.fields;
    final seasons = fields.map((f) => f.currentSeason).toSet();
    final sharedSeason =
        seasons.length == 1 && seasons.first.isNotEmpty ? seasons.first : null;

    return Scaffold(
      appBar: AppBar(title: const Text('Ruộng của tôi')),
      body: _loading && fields.isEmpty
          ? const _FieldsSkeleton()
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  if (!data.usesRemote) ...[
                    const OfflineBanner(message: 'Đang xem dữ liệu đã lưu'),
                    const SizedBox(height: 12),
                  ],
                  if (fields.isEmpty) ...[
                    const SizedBox(height: 64),
                    const RiceEmptyState(
                      message:
                          'Chưa có thửa ruộng\nLiên hệ HTX để được gán ruộng.',
                      icon: Icons.map_outlined,
                    ),
                  ] else ...[
                    _SummaryStrip(fieldCount: fields.length),
                    const SizedBox(height: 16),
                    _ListHeader(season: sharedSeason),
                    const SizedBox(height: 8),
                    for (final field in fields)
                      _FieldCard(
                        field: field,
                        alerts: alertsForField(data.alerts, field),
                        showSeason: sharedSeason == null &&
                            field.currentSeason.isNotEmpty,
                      ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _FieldsSkeleton extends StatelessWidget {
  const _FieldsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const RiceSkeleton(height: 84),
        const SizedBox(height: 24),
        RiceSkeleton.list(count: 3, height: 104),
      ],
    );
  }
}

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({required this.fieldCount});

  final int fieldCount;

  @override
  Widget build(BuildContext context) {
    return RiceCard(
      child: IntrinsicHeight(
        child: Row(
          children: [
            Expanded(
              child: _Kpi(label: 'Số thửa', value: '$fieldCount'),
            ),
            const VerticalDivider(
              width: 24,
              thickness: 1,
              color: AppColors.border,
            ),
            const Expanded(
              child: _Kpi(label: 'Tổng diện tích', value: '$metricDash ha'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class _ListHeader extends StatelessWidget {
  const _ListHeader({this.season});

  final String? season;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(
          child: Text(
            'Danh sách thửa',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        if (season != null)
          Text(
            'Mùa vụ: $season',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
      ],
    );
  }
}

class _FieldCard extends StatelessWidget {
  const _FieldCard({
    required this.field,
    required this.alerts,
    required this.showSeason,
  });

  final FieldModel field;
  final List<AlertModel> alerts;
  final bool showSeason;

  @override
  Widget build(BuildContext context) {
    final risk = highestRisk(alerts);
    return RiceCard(
      margin: const EdgeInsets.only(bottom: 12),
      onTap: () => context.push('/fields/${field.id}', extra: field),
      child: Row(
        children: [
          _FieldThumb(field: field),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  field.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    if (field.variety.isNotEmpty)
                      _Meta(icon: Icons.eco_outlined, text: field.variety),
                    const _Meta(
                      icon: Icons.square_foot,
                      text: '$metricDash ha',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (risk != null) ...[
                      AlertBadge(riskLevel: risk),
                      Text(
                        '${alerts.length} cảnh báo',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ] else
                      const _StableStatus(),
                    if (showSeason) _SeasonChip(season: field.currentSeason),
                  ],
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.textSecondary),
        ],
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class _StableStatus extends StatelessWidget {
  const _StableStatus();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.check_circle_outline, size: 16, color: AppColors.primary),
        SizedBox(width: 4),
        Text(
          'Ổn định',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class _SeasonChip extends StatelessWidget {
  const _SeasonChip({required this.season});

  final String season;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        season,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

class _FieldThumb extends StatelessWidget {
  const _FieldThumb({required this.field});

  final FieldModel field;

  static const double _size = 72;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: _size,
      height: _size,
      color: AppColors.primary.withValues(alpha: 0.12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.grass, color: AppColors.primary, size: 20),
          const SizedBox(height: 2),
          Text(
            fieldInitials(field.name),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
    final coverUrl = field.coverUrl;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: coverUrl != null && coverUrl.isNotEmpty
          ? Image.network(
              coverUrl,
              width: _size,
              height: _size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => placeholder,
            )
          : placeholder,
    );
  }
}

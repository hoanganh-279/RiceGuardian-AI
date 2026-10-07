import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../constants/alert_labels.dart';
import '../../models/alert_model.dart';
import '../../providers/app_providers.dart';
import '../../services/disease_catalog_service.dart';
import '../../utils/date_display.dart';
import '../../widgets/alert_badge.dart';
import '../../widgets/rice/rice.dart';

enum _AlertFilter { all, environment, image }

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  _AlertFilter _filter = _AlertFilter.all;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppDataProvider>().refreshAlerts();
    });
  }

  List<AlertModel> _filtered(List<AlertModel> alerts) {
    switch (_filter) {
      case _AlertFilter.environment:
        return alerts.where((a) => a.isEnvironment).toList();
      case _AlertFilter.image:
        return alerts.where((a) => a.isImageDetection).toList();
      case _AlertFilter.all:
        return alerts;
    }
  }

  void _showGuide(AlertModel alert) {
    final name = alert.title.replaceFirst('Phát hiện: ', '').trim();
    final entry = DiseaseCatalogService.instance.lookupByNameVi(name);
    if (entry == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chưa có hướng dẫn cho bệnh này.')),
      );
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.55,
        minChildSize: 0.35,
        maxChildSize: 0.9,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Text(
              entry.nameVi,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            DiseaseSummaryChip(name: entry.nameVi, confidence: alert.confidence),
            const SizedBox(height: 12),
            DiseaseGuideBlock(entry: entry),
          ],
        ),
      ),
    );
  }

  Widget _alertCard(AlertModel alert) {
    final name = alert.title.replaceFirst('Phát hiện: ', '').trim();
    final isEnv = alert.isEnvironment;
    final tint = isEnv ? AppColors.secondary : AppColors.primary;
    return RiceCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isEnv ? Icons.sensors : Icons.photo_camera_outlined,
              size: 22,
              color: isEnv ? const Color(0xFF8D6E00) : AppColors.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    AlertTypeChip(isEnvironment: isEnv),
                    AlertBadge(riskLevel: alert.riskLevel),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  alert.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
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
                if (alert.createdAt.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    formatDateTime(alert.createdAt),
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
                if (alert.isImageDetection) ...[
                  const SizedBox(height: 8),
                  DiseaseSummaryChip(
                    name: name,
                    confidence: alert.confidence,
                    healthy: name == 'Khỏe mạnh',
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => _showGuide(alert),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                      child: const Text('Xem hướng dẫn'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AppDataProvider>();
    final alerts = _filtered(data.alerts);

    return Scaffold(
      appBar: AppBar(title: const Text('Cảnh báo')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: RiceFilterChips<_AlertFilter>(
              options: [
                const ChoiceOption(value: _AlertFilter.all, label: 'Tất cả'),
                ChoiceOption(
                  value: _AlertFilter.environment,
                  label: kAlertTypeLabel['environment']!,
                ),
                ChoiceOption(
                  value: _AlertFilter.image,
                  label: kAlertTypeLabel['image']!,
                ),
              ],
              selected: _filter,
              onSelected: (v) => setState(() => _filter = v),
            ),
          ),
          if (_filter != _AlertFilter.all)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                kAlertTypeHint[_filter == _AlertFilter.environment
                    ? 'environment'
                    : 'image']!,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: data.refreshAlerts,
              child: data.loading && data.alerts.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(16),
                      children: [RiceSkeleton.list(count: 3, height: 120)],
                    )
                  : alerts.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [
                            SizedBox(height: 80),
                            RiceEmptyState(
                              message: 'Chưa có cảnh báo. Ruộng đang ổn!',
                              icon: Icons.eco_outlined,
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemCount: alerts.length,
                          itemBuilder: (context, index) =>
                              _alertCard(alerts[index]),
                        ),
            ),
          ),
        ],
      ),
    );
  }
}

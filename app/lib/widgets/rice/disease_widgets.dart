import 'package:flutter/material.dart';

import '../../config/app_colors.dart';
import '../../services/disease_catalog_service.dart';
import '../../utils/metric_display.dart';

class DiseaseActionList extends StatelessWidget {
  const DiseaseActionList({
    super.key,
    required this.actions,
    this.title = 'Hướng dẫn xử lý',
  });

  final List<String> actions;
  final String title;

  factory DiseaseActionList.fromEntry(DiseaseCatalogEntry entry) {
    return DiseaseActionList(actions: entry.actions);
  }

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
        ),
        const SizedBox(height: 10),
        for (var i = 0; i < actions.length; i++) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '${i + 1}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  actions[i],
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.4,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          if (i < actions.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class DiseaseSummaryChip extends StatelessWidget {
  const DiseaseSummaryChip({
    super.key,
    required this.name,
    this.confidence,
    this.healthy = false,
  });

  final String name;
  final double? confidence;
  final bool healthy;

  @override
  Widget build(BuildContext context) {
    final color = healthy ? AppColors.primary : AppColors.danger;
    final c = confidence;
    final label = c == null
        ? name
        : '$name · ${c > 0 ? '${(c * 100).round()}%' : metricDash}';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            healthy ? Icons.check_circle : Icons.coronavirus_outlined,
            size: 18,
            color: color,
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Catalog detail block: summary + action steps.
class DiseaseGuideBlock extends StatelessWidget {
  const DiseaseGuideBlock({super.key, required this.entry});

  final DiseaseCatalogEntry entry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Biết thêm về bệnh',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          entry.summary,
          style: const TextStyle(
            fontSize: 14,
            height: 1.45,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 14),
        DiseaseActionList.fromEntry(entry),
      ],
    );
  }
}

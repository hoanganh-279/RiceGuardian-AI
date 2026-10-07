import 'package:flutter/material.dart';

import '../../config/app_colors.dart';

/// Non-interactive hint chip (e.g. camera tips).
class TipChip extends StatelessWidget {
  const TipChip({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 20, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
          ),
        ],
      ),
    );
  }
}

/// Q&A status: "Chờ trả lời" / "Đã trả lời".
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.answered});

  final bool answered;

  @override
  Widget build(BuildContext context) {
    final color = answered ? AppColors.primary : AppColors.secondary;
    final textColor = answered ? AppColors.primary : const Color(0xFF8D6E00);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            answered ? Icons.check_circle_outline : Icons.schedule,
            size: 14,
            color: textColor,
          ),
          const SizedBox(width: 4),
          Text(
            answered ? 'Đã trả lời' : 'Chờ trả lời',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}

class ChoiceOption<T> {
  const ChoiceOption({required this.value, required this.label, this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// Large single-select chips (2–4 options).
class ChoiceChipGroup<T> extends StatelessWidget {
  const ChoiceChipGroup({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  final List<ChoiceOption<T>> options;
  final T? selected;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final o in options)
          ChoiceChip(
            showCheckmark: false,
            avatar: o.icon == null
                ? null
                : Icon(
                    o.icon,
                    size: 20,
                    color: o.value == selected
                        ? AppColors.primary
                        : AppColors.textSecondary,
                  ),
            label: Text(o.label),
            labelStyle: TextStyle(
              fontSize: 14,
              fontWeight:
                  o.value == selected ? FontWeight.w600 : FontWeight.w500,
              color: o.value == selected
                  ? AppColors.primary
                  : AppColors.textPrimary,
            ),
            selected: o.value == selected,
            onSelected: (_) => onSelected(o.value),
            backgroundColor: AppColors.surface,
            selectedColor: AppColors.primary.withValues(alpha: 0.12),
            side: BorderSide(
              color: o.value == selected ? AppColors.primary : AppColors.border,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          ),
      ],
    );
  }
}

/// Horizontal row of single-select filter chips.
class RiceFilterChips<T> extends StatelessWidget {
  const RiceFilterChips({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  final List<ChoiceOption<T>> options;
  final T selected;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final o in options) ...[
            FilterChip(
              label: Text(o.label),
              selected: o.value == selected,
              onSelected: (_) => onSelected(o.value),
              checkmarkColor: AppColors.primary,
              backgroundColor: AppColors.surface,
              selectedColor: AppColors.primary.withValues(alpha: 0.12),
              labelStyle: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: o.value == selected
                    ? AppColors.primary
                    : AppColors.textPrimary,
              ),
              side: BorderSide(
                color:
                    o.value == selected ? AppColors.primary : AppColors.border,
              ),
              visualDensity: VisualDensity.compact,
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

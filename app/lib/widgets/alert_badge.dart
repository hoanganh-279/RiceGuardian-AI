import 'package:flutter/material.dart';

import '../config/app_colors.dart';
import '../constants/alert_labels.dart';

/// Risk pill: "Nguy cơ cao" / "Trung bình" / "Ổn định".
class AlertBadge extends StatelessWidget {
  const AlertBadge({super.key, required this.riskLevel});

  final String riskLevel;

  Color get _color {
    switch (riskLevel) {
      case 'high':
        return AppColors.danger;
      case 'medium':
        return AppColors.secondary;
      default:
        return AppColors.primary;
    }
  }

  IconData get _icon {
    switch (riskLevel) {
      case 'high':
        return Icons.error_outline;
      case 'medium':
        return Icons.warning_amber_rounded;
      default:
        return Icons.check_circle_outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    final textColor =
        riskLevel == 'medium' ? const Color(0xFF8D6E00) : _color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_icon, size: 14, color: textColor),
          const SizedBox(width: 4),
          Text(
            riskLabel(riskLevel),
            style: TextStyle(
              color: textColor,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

/// Two variants, never merged: environment risk (outlined, secondary) vs
/// image recognition (tonal, primary).
class AlertTypeChip extends StatelessWidget {
  const AlertTypeChip({super.key, required this.isEnvironment});

  final bool isEnvironment;

  @override
  Widget build(BuildContext context) {
    final label = alertTypeLabel(isEnvironment: isEnvironment);
    final color =
        isEnvironment ? const Color(0xFF8D6E00) : AppColors.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isEnvironment
            ? Colors.transparent
            : AppColors.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: isEnvironment ? Border.all(color: AppColors.secondary) : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isEnvironment ? Icons.sensors : Icons.photo_camera_outlined,
            size: 14,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

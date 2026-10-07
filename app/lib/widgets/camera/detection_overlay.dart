import 'dart:io';

import 'package:flutter/material.dart';

import '../../config/app_colors.dart';
import '../../services/ai_service.dart';

class DiseaseScoreBars extends StatelessWidget {
  const DiseaseScoreBars({
    super.key,
    required this.scores,
    required this.highlightedLabel,
    required this.highlightColor,
  });

  final List<DiseaseScore> scores;
  final String highlightedLabel;
  final Color highlightColor;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Khả năng mắc bệnh',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < scores.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              _ScoreBarRow(
                score: scores[i],
                highlighted: scores[i].label == highlightedLabel,
                highlightColor: highlightColor,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ScoreBarRow extends StatelessWidget {
  const _ScoreBarRow({
    required this.score,
    required this.highlighted,
    required this.highlightColor,
  });

  final DiseaseScore score;
  final bool highlighted;
  final Color highlightColor;

  @override
  Widget build(BuildContext context) {
    final value = score.confidence.clamp(0.0, 1.0);
    final pct = (value * 100).round();
    final barColor = highlighted ? highlightColor : AppColors.secondary;
    final labelStyle = TextStyle(
      fontWeight: highlighted ? FontWeight.w700 : FontWeight.w600,
      color: highlighted ? highlightColor : AppColors.textPrimary,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(score.label, style: labelStyle)),
            Text('$pct%', style: labelStyle),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 8,
            backgroundColor: AppColors.border,
            color: barColor,
          ),
        ),
      ],
    );
  }
}

class DetectionImage extends StatelessWidget {
  const DetectionImage({
    super.key,
    required this.imagePath,
    required this.imageSize,
    required this.boxes,
    required this.strokeColor,
    this.primaryLabel,
  });

  final String imagePath;
  final Size? imageSize;
  final List<AiBox> boxes;
  final Color strokeColor;

  /// Boxes with another label are drawn in [AppColors.secondary].
  final String? primaryLabel;

  @override
  Widget build(BuildContext context) {
    final size = imageSize;
    if (size == null || size.width <= 0 || size.height <= 0) {
      return Image.file(
        File(imagePath),
        height: 240,
        width: double.infinity,
        fit: BoxFit.cover,
      );
    }

    return AspectRatio(
      aspectRatio: size.width / size.height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.file(File(imagePath), fit: BoxFit.fill),
          if (boxes.isNotEmpty)
            CustomPaint(
              painter: BoxOverlayPainter(
                boxes: boxes,
                imageSize: size,
                strokeColor: strokeColor,
                primaryLabel: primaryLabel,
              ),
            ),
        ],
      ),
    );
  }
}

class BoxOverlayPainter extends CustomPainter {
  BoxOverlayPainter({
    required this.boxes,
    required this.imageSize,
    required this.strokeColor,
    this.primaryLabel,
  });

  final List<AiBox> boxes;
  final Size imageSize;
  final Color strokeColor;
  final String? primaryLabel;

  @override
  void paint(Canvas canvas, Size size) {
    if (imageSize.width <= 0 || imageSize.height <= 0) return;
    final sx = size.width / imageSize.width;
    final sy = size.height / imageSize.height;

    for (final box in boxes) {
      final color = primaryLabel == null || box.label == primaryLabel
          ? strokeColor
          : AppColors.secondary;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..color = color;
      final fill = Paint()
        ..style = PaintingStyle.fill
        ..color = color.withValues(alpha: 0.12);
      final labelBg = Paint()
        ..style = PaintingStyle.fill
        ..color = color;
      final rect = Rect.fromLTRB(
        box.x1 * sx,
        box.y1 * sy,
        box.x2 * sx,
        box.y2 * sy,
      );
      canvas.drawRect(rect, fill);
      canvas.drawRect(rect, paint);

      final pct = (box.confidence.clamp(0.0, 1.0) * 100).round();
      final label =
          box.label.trim().isEmpty ? '$pct%' : '${box.label} $pct%';
      final textPainter = TextPainter(
        text: TextSpan(
          text: label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            height: 1.2,
          ),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
        ellipsis: '…',
      )..layout(maxWidth: (rect.width - 4).clamp(48.0, size.width));

      const padX = 4.0;
      const padY = 2.0;
      final labelH = textPainter.height + padY * 2;
      final labelW = (textPainter.width + padX * 2).clamp(0.0, size.width);

      var labelTop = rect.top - labelH - 2;
      if (labelTop < 0) {
        labelTop = rect.top + 2;
      }
      var labelLeft = rect.left;
      if (labelLeft + labelW > size.width) {
        labelLeft = (size.width - labelW).clamp(0.0, size.width);
      }
      if (labelLeft < 0) labelLeft = 0;

      final bgRect = Rect.fromLTWH(labelLeft, labelTop, labelW, labelH);
      canvas.drawRRect(
        RRect.fromRectAndRadius(bgRect, const Radius.circular(2)),
        labelBg,
      );
      textPainter.paint(
        canvas,
        Offset(labelLeft + padX, labelTop + padY),
      );
    }
  }

  @override
  bool shouldRepaint(covariant BoxOverlayPainter oldDelegate) {
    return oldDelegate.boxes != boxes ||
        oldDelegate.imageSize != imageSize ||
        oldDelegate.strokeColor != strokeColor ||
        oldDelegate.primaryLabel != primaryLabel;
  }
}

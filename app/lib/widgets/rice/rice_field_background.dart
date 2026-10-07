import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../config/app_colors.dart';

/// Stylized rice-field backdrop: sky gradient + layered field waves.
class RiceFieldBackground extends StatelessWidget {
  const RiceFieldBackground({
    super.key,
    this.child,
    this.showWaves = true,
  });

  final Widget? child;
  final bool showWaves;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                AppColors.skyTop,
                AppColors.skyMid,
                Color(0xFFE8F5E9),
                AppColors.fieldGreen,
              ],
              stops: [0.0, 0.35, 0.55, 1.0],
            ),
          ),
        ),
        if (showWaves)
          const CustomPaint(
            painter: _RiceFieldPainter(),
            size: Size.infinite,
          ),
        if (child != null) child!,
      ],
    );
  }
}

class _RiceFieldPainter extends CustomPainter {
  const _RiceFieldPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final deep = Paint()..color = AppColors.fieldDeep.withValues(alpha: 0.55);
    final mid = Paint()..color = AppColors.primary.withValues(alpha: 0.45);
    final light = Paint()..color = AppColors.fieldGreen.withValues(alpha: 0.65);

    void wave(Paint paint, double topRatio, double amplitude, double phase) {
      final path = Path()
        ..moveTo(0, size.height)
        ..lineTo(0, size.height * topRatio);
      const steps = 40;
      for (var i = 0; i <= steps; i++) {
        final x = size.width * i / steps;
        final y = size.height * topRatio +
            amplitude * math.sin(i / steps * math.pi * 2 + phase);
        path.lineTo(x, y);
      }
      path
        ..lineTo(size.width, size.height)
        ..close();
      canvas.drawPath(path, paint);
    }

    wave(deep, 0.62, 18, 0);
    wave(mid, 0.72, 14, 1.2);
    wave(light, 0.82, 10, 2.4);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

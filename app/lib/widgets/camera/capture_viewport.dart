import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../config/app_colors.dart';

class CaptureViewport extends StatelessWidget {
  const CaptureViewport({
    super.key,
    required this.cameraReady,
    required this.controller,
    required this.cameraError,
    required this.onRetry,
  });

  final bool cameraReady;
  final CameraController? controller;
  final String? cameraError;
  final VoidCallback onRetry;

  static const _radius = 16.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final side = constraints.maxWidth < constraints.maxHeight
            ? constraints.maxWidth
            : constraints.maxHeight;
        return Center(
          child: SizedBox(
            width: side,
            height: side,
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF5A5A5A),
                borderRadius: BorderRadius.circular(_radius),
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (cameraReady && controller != null)
                    FittedBox(
                      fit: BoxFit.cover,
                      child: SizedBox(
                        width: controller!.value.previewSize?.height ?? 1,
                        height: controller!.value.previewSize?.width ?? 1,
                        child: CameraPreview(controller!),
                      ),
                    )
                  else
                    _PlaceholderContent(
                      cameraError: cameraError,
                      onRetry: onRetry,
                    ),
                  const Positioned.fill(
                    child: IgnorePointer(
                      child: CustomPaint(
                        painter: CornerFramePainter(
                          color: AppColors.primary,
                          inset: 18,
                          armLength: 28,
                          strokeWidth: 3,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _PlaceholderContent extends StatelessWidget {
  const _PlaceholderContent({
    required this.cameraError,
    required this.onRetry,
  });

  final String? cameraError;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.photo_camera_outlined,
              size: 48,
              color: Colors.white.withValues(alpha: 0.55),
            ),
            const SizedBox(height: 12),
            Text(
              'Màn hình camera sẽ hiển thị ở đây',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                height: 1.35,
              ),
            ),
            if (cameraError != null) ...[
              const SizedBox(height: 10),
              Text(
                'Camera không khả dụng. Bạn vẫn có thể tải ảnh từ thư viện.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.55),
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: onRetry,
                style: TextButton.styleFrom(foregroundColor: Colors.white),
                child: const Text('Thử mở lại camera'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class CornerFramePainter extends CustomPainter {
  const CornerFramePainter({
    required this.color,
    required this.inset,
    required this.armLength,
    required this.strokeWidth,
  });

  final Color color;
  final double inset;
  final double armLength;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.square;

    final left = inset;
    final top = inset;
    final right = size.width - inset;
    final bottom = size.height - inset;

    canvas.drawLine(Offset(left, top), Offset(left + armLength, top), paint);
    canvas.drawLine(Offset(left, top), Offset(left, top + armLength), paint);
    canvas.drawLine(Offset(right, top), Offset(right - armLength, top), paint);
    canvas.drawLine(Offset(right, top), Offset(right, top + armLength), paint);
    canvas.drawLine(
      Offset(left, bottom),
      Offset(left + armLength, bottom),
      paint,
    );
    canvas.drawLine(
      Offset(left, bottom),
      Offset(left, bottom - armLength),
      paint,
    );
    canvas.drawLine(
      Offset(right, bottom),
      Offset(right - armLength, bottom),
      paint,
    );
    canvas.drawLine(
      Offset(right, bottom),
      Offset(right, bottom - armLength),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CornerFramePainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.inset != inset ||
        oldDelegate.armLength != armLength ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}

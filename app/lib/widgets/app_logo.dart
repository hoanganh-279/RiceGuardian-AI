import 'package:flutter/material.dart';

enum AppLogoVariant { plain, circle }

/// Brand logo widget — mirrors web `RiceMark`.
class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.size = 72,
    this.variant = AppLogoVariant.plain,
  });

  static const _assetPath = 'img/logo_riceguardianai.png';

  final double size;
  final AppLogoVariant variant;

  @override
  Widget build(BuildContext context) {
    final image = Image.asset(
      _assetPath,
      height: size,
      width: size,
      fit: BoxFit.contain,
    );

    if (variant == AppLogoVariant.circle) {
      return ClipOval(child: image);
    }
    return image;
  }
}

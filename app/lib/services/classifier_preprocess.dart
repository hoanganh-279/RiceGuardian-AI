import 'dart:math' as math;

import 'package:image/image.dart' as img;

/// Pure helpers for the on-device rice leaf classifier (no TFLite).

/// Class labels ordered by index from `class_indices.json` (`{"name": index}`).
List<String> labelsFromClassIndices(Map<String, dynamic> classIndices) {
  final entries = classIndices.entries
      .map((e) => MapEntry(e.key, (e.value as num).toInt()))
      .toList()
    ..sort((a, b) => a.value.compareTo(b.value));
  return [for (final e in entries) e.key];
}

/// Plain resize to [size]x[size] (no letterbox), RGB.
img.Image resizeSquare(img.Image source, int size) {
  final rgb =
      source.numChannels == 3 ? source : source.convert(numChannels: 3);
  return img.copyResize(
    rgb,
    width: size,
    height: size,
    interpolation: img.Interpolation.linear,
  );
}

/// TTA views listed in `pipeline_config.json` (`orig`, `hflip`, `vflip`).
List<img.Image> ttaViews(img.Image source, List<String> views) {
  final out = <img.Image>[];
  for (final v in views) {
    switch (v) {
      case 'orig':
        out.add(source);
      case 'hflip':
        out.add(img.flipHorizontal(img.Image.from(source)));
      case 'vflip':
        out.add(img.flipVertical(img.Image.from(source)));
    }
  }
  return out.isEmpty ? [source] : out;
}

bool looksLikeProbabilities(List<double> values, {double tolerance = 0.02}) {
  if (values.isEmpty) return false;
  var sum = 0.0;
  for (final v in values) {
    if (v < 0) return false;
    sum += v;
  }
  return (sum - 1.0).abs() < tolerance;
}

/// Scales non-negative scores so they sum to 1.
List<double> normalizeScores(List<double> values) {
  final sum = values.fold<double>(0, (a, b) => a + b);
  if (sum <= 0) return values;
  return [for (final v in values) v / sum];
}

List<double> softmax(List<double> logits, {double temperature = 1.0}) {
  if (logits.isEmpty) return const [];
  final t = temperature <= 0 ? 1.0 : temperature;
  final maxV = logits.reduce(math.max);
  final exps = [for (final l in logits) math.exp((l - maxV) / t)];
  final sum = exps.fold<double>(0, (a, b) => a + b);
  return [for (final e in exps) e / sum];
}

/// Element-wise mean of class-score vectors. Empty if none or lengths differ.
List<double> meanClassScores(List<List<double>> vectors) {
  if (vectors.isEmpty) return const [];
  final n = vectors.first.length;
  if (n == 0) return const [];
  for (final v in vectors) {
    if (v.length != n) return const [];
  }
  final out = List<double>.filled(n, 0);
  for (final v in vectors) {
    for (var i = 0; i < n; i++) {
      out[i] += v[i];
    }
  }
  final inv = 1.0 / vectors.length;
  for (var i = 0; i < n; i++) {
    out[i] *= inv;
  }
  return out;
}

int argmaxScores(List<double> scores) {
  if (scores.isEmpty) return 0;
  var best = 0;
  for (var i = 1; i < scores.length; i++) {
    if (scores[i] > scores[best]) best = i;
  }
  return best;
}

class ClassifierDecision {
  const ClassifierDecision({
    required this.index,
    required this.confidence,
    required this.accepted,
  });

  final int index;
  final double confidence;

  /// False when the top probability is below the reject threshold.
  final bool accepted;
}

/// Integer crop rectangle in image pixels.
class CropRect {
  const CropRect({
    required this.x,
    required this.y,
    required this.width,
    required this.height,
  });

  final int x;
  final int y;
  final int width;
  final int height;
}

/// Expands box xyxy by [padding] × its size on each side, clamped to the image.
/// Null when the result is smaller than [minSide] pixels on either side.
CropRect? paddedCropRect(
  double x1,
  double y1,
  double x2,
  double y2, {
  required double padding,
  required int imageWidth,
  required int imageHeight,
  int minSide = 16,
}) {
  final padX = (x2 - x1).abs() * padding;
  final padY = (y2 - y1).abs() * padding;
  final left = (math.min(x1, x2) - padX).clamp(0.0, imageWidth.toDouble());
  final top = (math.min(y1, y2) - padY).clamp(0.0, imageHeight.toDouble());
  final right = (math.max(x1, x2) + padX).clamp(0.0, imageWidth.toDouble());
  final bottom = (math.max(y1, y2) + padY).clamp(0.0, imageHeight.toDouble());
  final x = left.floor();
  final y = top.floor();
  final w = right.ceil() - x;
  final h = bottom.ceil() - y;
  if (w < minSide || h < minSide) return null;
  return CropRect(x: x, y: y, width: w, height: h);
}

/// Classifier top class for one detected region.
class RegionClass {
  const RegionClass({
    required this.modelClass,
    required this.confidence,
    double? share,
  }) : share = share ?? confidence;

  final String modelClass;

  /// Raw softmax probability of [modelClass] on the crop.
  final double confidence;

  /// Probability of [modelClass] among disease classes only (Healthy removed).
  final double share;
}

/// Strongest region disease that differs from [primaryClass], is not
/// [healthyClass] and reaches [minConf]; null otherwise.
RegionClass? pickSecondaryDisease(
  String primaryClass,
  List<RegionClass> regions, {
  required double minConf,
  required String healthyClass,
}) {
  RegionClass? best;
  for (final r in regions) {
    if (r.modelClass == primaryClass || r.modelClass == healthyClass) continue;
    if (r.confidence < minConf) continue;
    if (best == null || r.confidence > best.confidence) best = r;
  }
  return best;
}

/// Probabilities renormalised over disease classes: [healthyIndex] becomes 0
/// and the rest sum to 1. All zeros when no disease mass is left.
List<double> diseaseShares(List<double> probabilities, int healthyIndex) {
  var sum = 0.0;
  for (var i = 0; i < probabilities.length; i++) {
    if (i != healthyIndex) sum += probabilities[i];
  }
  return [
    for (var i = 0; i < probabilities.length; i++)
      i == healthyIndex || sum <= 0 ? 0.0 : probabilities[i] / sum,
  ];
}

/// What the result screen shows for one photo.
class DiseaseView {
  const DiseaseView({
    required this.stage,
    this.primaryClass = '',
    this.primaryPercent = 0,
    this.secondaryClass,
    this.secondaryPercent,
    this.regionIndices = const [],
  });

  /// `healthy` | `classifier` | `uncertain`
  final String stage;

  /// Model class of the main disease (Healthy class when [stage] is `healthy`).
  final String primaryClass;

  /// 0..1. Disease likelihood shown to the user; for two diseases the pair
  /// sums to 1. For `healthy` it is the Healthy probability.
  final double primaryPercent;
  final String? secondaryClass;
  final double? secondaryPercent;

  /// Indices into the regions list whose boxes should be drawn.
  final List<int> regionIndices;
}

/// Combines the full-image classifier with per-region crop results.
///
/// A region is valid when its crop is a disease at or above [rejectThreshold].
/// Disease: full image is an accepted disease, or a valid region reaches
/// [secondMinConf]. Healthy: full image is accepted Healthy and no such region.
/// Otherwise uncertain. At most two diseases are reported.
DiseaseView buildDiseaseView({
  required List<String> classes,
  required List<double> fullProbs,
  required List<RegionClass?> regions,
  required String healthyClass,
  required double rejectThreshold,
  required double secondMinConf,
}) {
  final decision = decideTopClass(fullProbs, rejectThreshold: rejectThreshold);
  final healthyIndex = classes.indexOf(healthyClass);
  final shares = diseaseShares(fullProbs, healthyIndex);

  final valid = <int>[
    for (var i = 0; i < regions.length; i++)
      if (regions[i] != null &&
          regions[i]!.modelClass != healthyClass &&
          regions[i]!.confidence >= rejectThreshold)
        i,
  ];
  RegionClass? strongest;
  for (final i in valid) {
    final r = regions[i]!;
    if (r.confidence >= secondMinConf &&
        (strongest == null || r.confidence > strongest.confidence)) {
      strongest = r;
    }
  }

  final topClass = fullProbs.isEmpty ? '' : classes[decision.index];
  final fullIsDisease = decision.accepted && topClass != healthyClass;

  String primary;
  if (fullIsDisease) {
    primary = topClass;
  } else if (strongest != null) {
    primary = strongest.modelClass;
  } else if (decision.accepted) {
    return DiseaseView(
      stage: 'healthy',
      primaryClass: healthyClass,
      primaryPercent: decision.confidence,
    );
  } else {
    return DiseaseView(stage: 'uncertain', regionIndices: valid);
  }

  double score(String modelClass) {
    final idx = classes.indexOf(modelClass);
    var s = idx < 0 ? 0.0 : shares[idx];
    for (final i in valid) {
      final r = regions[i]!;
      if (r.modelClass == modelClass && r.share > s) s = r.share;
    }
    return s.clamp(0.0, 1.0);
  }

  final secondary = pickSecondaryDisease(
    primary,
    [for (final i in valid) regions[i]!],
    minConf: secondMinConf,
    healthyClass: healthyClass,
  );
  final shown = {primary, if (secondary != null) secondary.modelClass};
  final boxes = [
    for (final i in valid)
      if (shown.contains(regions[i]!.modelClass)) i,
  ];

  final sPrimary = score(primary);
  if (secondary == null) {
    return DiseaseView(
      stage: 'classifier',
      primaryClass: primary,
      primaryPercent: sPrimary,
      regionIndices: boxes,
    );
  }
  final sSecondary = score(secondary.modelClass);
  final total = sPrimary + sSecondary;
  return DiseaseView(
    stage: 'classifier',
    primaryClass: primary,
    primaryPercent: total > 0 ? sPrimary / total : 0,
    secondaryClass: secondary.modelClass,
    secondaryPercent: total > 0 ? sSecondary / total : 0,
    regionIndices: boxes,
  );
}

ClassifierDecision decideTopClass(
  List<double> probabilities, {
  required double rejectThreshold,
}) {
  final idx = argmaxScores(probabilities);
  final conf =
      probabilities.isEmpty ? 0.0 : probabilities[idx].clamp(0.0, 1.0);
  return ClassifierDecision(
    index: idx,
    confidence: conf,
    accepted: probabilities.isNotEmpty && conf >= rejectThreshold,
  );
}

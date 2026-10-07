import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:app_riceguardianai/data/disease_code_map.dart';
import 'package:app_riceguardianai/services/classifier_preprocess.dart';

void main() {
  group('labelsFromClassIndices', () {
    test('orders labels by index', () {
      final labels = labelsFromClassIndices({
        'Brown Spot': 1,
        'Sheath Blight': 7,
        'Bacterial Leaf Blight': 0,
      });
      expect(labels, ['Bacterial Leaf Blight', 'Brown Spot', 'Sheath Blight']);
    });
  });

  group('ttaViews', () {
    img.Image marked() {
      final image = img.Image(width: 4, height: 4);
      image.setPixelRgb(0, 0, 255, 0, 0);
      return image;
    }

    test('orig / hflip / vflip move the marked pixel', () {
      final views = ttaViews(marked(), const ['orig', 'hflip', 'vflip']);
      expect(views, hasLength(3));
      expect(views[0].getPixel(0, 0).r, 255);
      expect(views[1].getPixel(3, 0).r, 255);
      expect(views[2].getPixel(0, 3).r, 255);
    });

    test('unknown views fall back to the source image', () {
      expect(ttaViews(marked(), const ['rot90']), hasLength(1));
    });

    test('resizeSquare returns size x size', () {
      final out = resizeSquare(img.Image(width: 640, height: 480), 300);
      expect(out.width, 300);
      expect(out.height, 300);
    });
  });

  group('scores', () {
    test('softmax sums to 1 and keeps order', () {
      final p = softmax([1.0, 3.0, 2.0]);
      expect(p.reduce((a, b) => a + b), closeTo(1.0, 1e-9));
      expect(argmaxScores(p), 1);
    });

    test('looksLikeProbabilities', () {
      expect(looksLikeProbabilities([0.2, 0.8]), isTrue);
      expect(looksLikeProbabilities([2.0, -1.0]), isFalse);
      expect(looksLikeProbabilities([0.5, 0.55], tolerance: 0.1), isTrue);
    });

    test('normalizeScores', () {
      final n = normalizeScores([1.0, 3.0]);
      expect(n[0], closeTo(0.25, 1e-9));
      expect(n[1], closeTo(0.75, 1e-9));
    });

    test('meanClassScores averages and rejects mismatched lengths', () {
      expect(
        meanClassScores([
          [0.2, 0.8],
          [0.4, 0.6],
        ]),
        [closeTo(0.3, 1e-9), closeTo(0.7, 1e-9)],
      );
      expect(
        meanClassScores([
          [0.5, 0.5],
          [1.0],
        ]),
        isEmpty,
      );
    });
  });

  group('decideTopClass', () {
    test('accepts at or above threshold 0.45', () {
      final d = decideTopClass([0.1, 0.45, 0.45 - 1e-6], rejectThreshold: 0.45);
      expect(d.index, 1);
      expect(d.accepted, isTrue);
    });

    test('rejects below threshold', () {
      final d = decideTopClass([0.3, 0.44, 0.26], rejectThreshold: 0.45);
      expect(d.index, 1);
      expect(d.accepted, isFalse);
    });

    test('empty input is never accepted', () {
      expect(decideTopClass(const [], rejectThreshold: 0.45).accepted, isFalse);
    });
  });

  group('kModelClassToVi', () {
    test('covers all 8 model classes', () {
      const classes = [
        'Bacterial Leaf Blight',
        'Brown Spot',
        'Healthy Rice Leaf',
        'Leaf Blast',
        'Leaf scald',
        'Narrow Brown Leaf Spot',
        'Rice Hispa',
        'Sheath Blight',
      ];
      for (final c in classes) {
        expect(kModelClassToVi.containsKey(c), isTrue, reason: c);
      }
      expect(viLabelForModelClass('Sheath Blight'), 'Khô vằn');
      expect(viLabelForModelClass('Unknown'), 'Unknown');
    });
  });

  group('paddedCropRect', () {
    test('expands by padding on each side', () {
      final r = paddedCropRect(
        100,
        100,
        200,
        140,
        padding: 0.25,
        imageWidth: 1000,
        imageHeight: 1000,
      )!;
      expect(r.x, 75);
      expect(r.y, 90);
      expect(r.width, 150);
      expect(r.height, 60);
    });

    test('clamps to image bounds', () {
      final r = paddedCropRect(
        0,
        0,
        100,
        100,
        padding: 0.25,
        imageWidth: 110,
        imageHeight: 110,
      )!;
      expect(r.x, 0);
      expect(r.y, 0);
      expect(r.width, 110);
      expect(r.height, 110);
    });

    test('returns null for tiny regions', () {
      expect(
        paddedCropRect(
          10,
          10,
          14,
          14,
          padding: 0.25,
          imageWidth: 100,
          imageHeight: 100,
        ),
        isNull,
      );
    });
  });

  group('pickSecondaryDisease', () {
    const healthy = 'Healthy Rice Leaf';

    test('picks strongest different disease at or above minConf', () {
      final s = pickSecondaryDisease(
        'Leaf Blast',
        const [
          RegionClass(modelClass: 'Leaf Blast', confidence: 0.95),
          RegionClass(modelClass: 'Brown Spot', confidence: 0.55),
          RegionClass(modelClass: 'Leaf scald', confidence: 0.7),
          RegionClass(modelClass: healthy, confidence: 0.99),
        ],
        minConf: 0.5,
        healthyClass: healthy,
      );
      expect(s?.modelClass, 'Leaf scald');
      expect(s?.confidence, 0.7);
    });

    test('null when only same, healthy or weak regions', () {
      final s = pickSecondaryDisease(
        'Leaf Blast',
        const [
          RegionClass(modelClass: 'Leaf Blast', confidence: 0.9),
          RegionClass(modelClass: healthy, confidence: 0.9),
          RegionClass(modelClass: 'Brown Spot', confidence: 0.49),
        ],
        minConf: 0.5,
        healthyClass: healthy,
      );
      expect(s, isNull);
    });
  });

  group('diseaseShares', () {
    test('drops Healthy and renormalises the rest', () {
      final s = diseaseShares(const [0.2, 0.3, 0.5], 2);
      expect(s[0], closeTo(0.4, 1e-9));
      expect(s[1], closeTo(0.6, 1e-9));
      expect(s[2], 0);
    });

    test('all zeros when only Healthy has mass', () {
      expect(diseaseShares(const [0.0, 1.0], 1), [0.0, 0.0]);
    });
  });

  group('buildDiseaseView', () {
    const classes = [
      'Bacterial Leaf Blight',
      'Brown Spot',
      'Healthy Rice Leaf',
      'Leaf Blast',
      'Leaf scald',
      'Narrow Brown Leaf Spot',
      'Rice Hispa',
      'Sheath Blight',
    ];
    const healthy = 'Healthy Rice Leaf';

    // Brown Spot 0.45, Healthy 0.10, Leaf Blast 0.23 (disease mass 0.90).
    const brownSpot = [0.05, 0.45, 0.10, 0.23, 0.05, 0.05, 0.04, 0.03];
    const healthyLeaf = [0.03, 0.03, 0.80, 0.04, 0.03, 0.03, 0.02, 0.02];
    const unsure = [0.10, 0.15, 0.30, 0.15, 0.10, 0.10, 0.05, 0.05];

    DiseaseView view(List<double> probs, List<RegionClass?> regions) =>
        buildDiseaseView(
          classes: classes,
          fullProbs: probs,
          regions: regions,
          healthyClass: healthy,
          rejectThreshold: 0.45,
          secondMinConf: 0.5,
        );

    test('healthy leaf: no boxes, Healthy probability', () {
      final v = view(healthyLeaf, const []);
      expect(v.stage, 'healthy');
      expect(v.primaryClass, healthy);
      expect(v.primaryPercent, closeTo(0.80, 1e-9));
      expect(v.regionIndices, isEmpty);
      expect(v.secondaryClass, isNull);
    });

    test('one disease: Healthy removed before the percentage', () {
      final v = view(brownSpot, const []);
      expect(v.stage, 'classifier');
      expect(v.primaryClass, 'Brown Spot');
      expect(v.primaryPercent, closeTo(0.45 / 0.90, 1e-9));
      expect(v.secondaryClass, isNull);
    });

    test('two diseases split to 100%', () {
      final v = view(brownSpot, const [
        RegionClass(modelClass: 'Brown Spot', confidence: 0.8, share: 0.85),
        RegionClass(modelClass: 'Leaf Blast', confidence: 0.6, share: 0.62),
      ]);
      expect(v.primaryClass, 'Brown Spot');
      expect(v.secondaryClass, 'Leaf Blast');
      expect(v.primaryPercent, closeTo(0.85 / 1.47, 1e-9));
      expect(v.secondaryPercent, closeTo(0.62 / 1.47, 1e-9));
      expect(v.primaryPercent + v.secondaryPercent!, closeTo(1, 1e-9));
      expect(v.regionIndices, [0, 1]);
    });

    test('a third disease box is not drawn', () {
      final v = view(brownSpot, const [
        RegionClass(modelClass: 'Brown Spot', confidence: 0.8),
        RegionClass(modelClass: 'Leaf Blast', confidence: 0.6),
        RegionClass(modelClass: 'Rice Hispa', confidence: 0.55),
      ]);
      expect(v.secondaryClass, 'Leaf Blast');
      expect(v.regionIndices, [0, 1]);
    });

    test('rejected, Healthy and weak crops are dropped', () {
      final v = view(brownSpot, const [
        null,
        RegionClass(modelClass: healthy, confidence: 0.9),
        RegionClass(modelClass: 'Leaf Blast', confidence: 0.40),
      ]);
      expect(v.stage, 'classifier');
      expect(v.regionIndices, isEmpty);
      expect(v.secondaryClass, isNull);
    });

    test('Healthy full image but a confirmed disease region', () {
      final v = view(healthyLeaf, const [
        RegionClass(modelClass: 'Leaf Blast', confidence: 0.6, share: 0.7),
      ]);
      expect(v.stage, 'classifier');
      expect(v.primaryClass, 'Leaf Blast');
      expect(v.primaryPercent, closeTo(0.7, 1e-9));
      expect(v.regionIndices, [0]);
    });

    test('Healthy full image with only a weak region stays healthy', () {
      final v = view(healthyLeaf, const [
        RegionClass(modelClass: 'Leaf Blast', confidence: 0.47),
      ]);
      expect(v.stage, 'healthy');
      expect(v.regionIndices, isEmpty);
    });

    test('uncertain full image becomes a disease with a strong region', () {
      final v = view(unsure, const [
        RegionClass(modelClass: 'Leaf scald', confidence: 0.75),
      ]);
      expect(v.stage, 'classifier');
      expect(v.primaryClass, 'Leaf scald');
      expect(v.regionIndices, [0]);
    });

    test('uncertain full image with a weak region stays uncertain', () {
      final v = view(unsure, const [
        RegionClass(modelClass: 'Leaf scald', confidence: 0.46),
      ]);
      expect(v.stage, 'uncertain');
      expect(v.primaryClass, '');
      expect(v.regionIndices, [0]);
    });

    test('Sheath Blight from the full image without boxes', () {
      const sheath = [0.02, 0.02, 0.10, 0.03, 0.03, 0.02, 0.02, 0.76];
      final v = view(sheath, const []);
      expect(v.primaryClass, 'Sheath Blight');
      expect(v.primaryPercent, closeTo(0.76 / 0.90, 1e-9));
      expect(v.regionIndices, isEmpty);
    });
  });
}

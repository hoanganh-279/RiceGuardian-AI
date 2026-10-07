import 'dart:typed_data';

import 'package:app_riceguardianai/services/yolo_tflite_helper.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

const _identity640 = LetterboxInfo(
  origW: 640,
  origH: 640,
  newW: 640,
  newH: 640,
  padX: 0,
  padY: 0,
  scale: 1.0,
  size: 640,
);

void main() {
  test('letterbox inverse maps center of padded canvas to original', () {
    final helper = YoloTfliteHelper(inputSize: 640);
    final source = img.Image(width: 320, height: 240);
    final boxed = helper.letterbox(source, 640);
    final info = boxed.info;

    expect(info.scale, closeTo(2.0, 1e-9));
    expect(info.newW, 640);
    expect(info.newH, 480);
    expect(info.padX, 0);
    expect(info.padY, 80);

    final det = helper.mapToOriginal(
      classId: 1,
      confidence: 0.9,
      x1: info.padX.toDouble(),
      y1: info.padY.toDouble(),
      x2: (info.padX + info.newW).toDouble(),
      y2: (info.padY + info.newH).toDouble(),
      info: info,
    );

    expect(det.x1, closeTo(0, 1e-6));
    expect(det.y1, closeTo(0, 1e-6));
    expect(det.x2, closeTo(320, 1e-6));
    expect(det.y2, closeTo(240, 1e-6));
  });

  test('mapToOriginal clamps out-of-bounds letterbox coords', () {
    final helper = YoloTfliteHelper(inputSize: 100);
    const info = LetterboxInfo(
      origW: 50,
      origH: 50,
      newW: 100,
      newH: 100,
      padX: 0,
      padY: 0,
      scale: 2.0,
      size: 100,
    );

    final det = helper.mapToOriginal(
      classId: 0,
      confidence: 0.8,
      x1: -10,
      y1: -10,
      x2: 200,
      y2: 200,
      info: info,
    );

    expect(det.x1, 0);
    expect(det.y1, 0);
    expect(det.x2, 50);
    expect(det.y2, 50);
  });

  test('boxIou is 1 for identical boxes and 0 for disjoint', () {
    const a = YoloDetection(
        classId: 0, confidence: 0.9, x1: 0, y1: 0, x2: 10, y2: 10);
    const b = YoloDetection(
        classId: 0, confidence: 0.8, x1: 0, y1: 0, x2: 10, y2: 10);
    const c = YoloDetection(
        classId: 1, confidence: 0.7, x1: 20, y1: 20, x2: 30, y2: 30);
    expect(YoloTfliteHelper.boxIou(a, b), closeTo(1.0, 1e-9));
    expect(YoloTfliteHelper.boxIou(a, c), 0);
  });

  test('detections applies NMS and respects topK (pixel coords)', () {
    final helper = YoloTfliteHelper(
      inputSize: 100,
      confThreshold: 0.25,
      iouThreshold: 0.45,
      numClasses: 2,
      topK: 2,
      coordsNormalized: false,
    );
    helper.lastLetterbox = const LetterboxInfo(
      origW: 100,
      origH: 100,
      newW: 100,
      newH: 100,
      padX: 0,
      padY: 0,
      scale: 1.0,
      size: 100,
    );

    const channels = 6;
    const anchors = 3;
    final flat = Float32List(channels * anchors);

    void setAnchor(int a, List<double> values) {
      for (var ch = 0; ch < channels; ch++) {
        flat[ch * anchors + a] = values[ch];
      }
    }

    setAnchor(0, [20, 20, 20, 20, 0.9, 0.1]);
    setAnchor(1, [22, 22, 20, 20, 0.7, 0.1]);
    setAnchor(2, [80, 80, 20, 20, 0.1, 0.6]);

    final dets = helper.detections([1, channels, anchors], flat);

    expect(dets.length, 2);
    expect(dets.first.classId, 0);
    expect(dets.first.confidence, closeTo(0.9, 1e-6));
    expect(dets.last.classId, 1);
    expect(dets.last.confidence, closeTo(0.6, 1e-6));
    expect(helper.lastMaxScore, closeTo(0.9, 1e-6));
  });

  test('raw [1,13,8400] with normalized coords maps to letterbox pixels', () {
    const numClasses = 9;
    const anchors = 8400;
    const channels = 4 + numClasses;
    final helper = YoloTfliteHelper(numClasses: numClasses);
    helper.lastLetterbox = _identity640;

    final flat = Float32List(channels * anchors);
    const a = 100;
    flat[0 * anchors + a] = 200 / 640;
    flat[1 * anchors + a] = 200 / 640;
    flat[2 * anchors + a] = 40 / 640;
    flat[3 * anchors + a] = 40 / 640;
    flat[4 * anchors + a] = 0.9;
    for (var c = 1; c < numClasses; c++) {
      flat[(4 + c) * anchors + a] = 0.01;
    }

    final dets = helper.detections([1, channels, anchors], flat);

    expect(dets, hasLength(1));
    expect(dets.first.classId, 0);
    expect(dets.first.x1, closeTo(180, 1e-3));
    expect(dets.first.y1, closeTo(180, 1e-3));
    expect(dets.first.x2, closeTo(220, 1e-3));
    expect(dets.first.y2, closeTo(220, 1e-3));
  });

  test('scores below conf_thresh 0.15 are dropped', () {
    const numClasses = 9;
    const anchors = 8400;
    const channels = 4 + numClasses;
    final helper = YoloTfliteHelper(numClasses: numClasses);
    helper.lastLetterbox = _identity640;

    final flat = Float32List(channels * anchors);
    flat[0 * anchors] = 0.5;
    flat[1 * anchors] = 0.5;
    flat[2 * anchors] = 0.1;
    flat[3 * anchors] = 0.1;
    flat[4 * anchors] = 0.14;

    expect(helper.detections([1, channels, anchors], flat), isEmpty);
    expect(helper.lastMaxScore, closeTo(0.14, 1e-6));
  });
}

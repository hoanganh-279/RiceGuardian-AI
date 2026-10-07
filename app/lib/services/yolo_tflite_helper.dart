import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

/// One detection mapped to original image pixel coordinates (xyxy).
class YoloDetection {
  const YoloDetection({
    required this.classId,
    required this.confidence,
    required this.x1,
    required this.y1,
    required this.x2,
    required this.y2,
  });

  final int classId;
  final double confidence;
  final double x1;
  final double y1;
  final double x2;
  final double y2;

  double get width => x2 - x1;
  double get height => y2 - y1;
}

/// Letterbox metadata for mapping model coords → original image.
class LetterboxInfo {
  const LetterboxInfo({
    required this.origW,
    required this.origH,
    required this.newW,
    required this.newH,
    required this.padX,
    required this.padY,
    required this.scale,
    required this.size,
  });

  final int origW;
  final int origH;
  final int newW;
  final int newH;
  final int padX;
  final int padY;
  final double scale;
  final int size;
}

/// Letterbox + YOLO TFLite post-process for the Ultralytics rice-leaf export.
class YoloTfliteHelper {
  YoloTfliteHelper({
    this.inputSize = 640,
    this.confThreshold = 0.15,
    this.iouThreshold = 0.7,
    this.numClasses = 9,
    this.topK = 3,
    this.coordsNormalized = true,
  });

  final int inputSize;
  final double confThreshold;
  final double iouThreshold;
  final int numClasses;
  final int topK;

  /// Raw xywh are 0..1 of the letterbox canvas (`coords_normalized` in config).
  final bool coordsNormalized;

  LetterboxInfo? lastLetterbox;

  /// Highest class score seen in the last parse (even if below threshold).
  double lastMaxScore = 0.0;

  /// NHWC float32 input in [0, 1], letterboxed to [inputSize, inputSize].
  Float32List preprocess(img.Image source) {
    final boxed = letterbox(source, inputSize);
    lastLetterbox = boxed.info;
    final letterboxed = boxed.image;
    final floats = Float32List(inputSize * inputSize * 3);
    var i = 0;
    for (var y = 0; y < inputSize; y++) {
      for (var x = 0; x < inputSize; x++) {
        final p = letterboxed.getPixel(x, y);
        floats[i++] = p.r / 255.0;
        floats[i++] = p.g / 255.0;
        floats[i++] = p.b / 255.0;
      }
    }
    return floats;
  }

  /// Resize with padding (color 114) preserving aspect ratio — Ultralytics style.
  ({img.Image image, LetterboxInfo info}) letterbox(img.Image source, int size) {
    final scale = math.min(size / source.width, size / source.height);
    final newW = math.max(1, (source.width * scale).round());
    final newH = math.max(1, (source.height * scale).round());
    final resized = img.copyResize(
      source,
      width: newW,
      height: newH,
      interpolation: img.Interpolation.linear,
    );
    final canvas = img.Image(width: size, height: size);
    img.fill(canvas, color: img.ColorRgb8(114, 114, 114));
    final padX = ((size - newW) / 2).floor();
    final padY = ((size - newH) / 2).floor();
    img.compositeImage(canvas, resized, dstX: padX, dstY: padY);
    final info = LetterboxInfo(
      origW: source.width,
      origH: source.height,
      newW: newW,
      newH: newH,
      padX: padX,
      padY: padY,
      scale: scale,
      size: size,
    );
    return (image: canvas, info: info);
  }

  /// Runs the interpreter on flat buffers.
  ///
  /// Pass [ByteBuffer]s to [Interpreter.run]: `list.reshape()` builds a new
  /// nested List, so writes into it never reach the source [Float32List].
  Float32List run(Interpreter interpreter, Float32List inputFloats) {
    final inputShape = interpreter.getInputTensor(0).shape;
    final outShape = interpreter.getOutputTensor(0).shape;
    final outSize = outShape.fold<int>(1, (a, b) => a * b);
    final output = Float32List(outSize);

    ByteBuffer inputBuffer;
    if (inputShape.length == 4 &&
        inputShape[1] == 3 &&
        inputShape[2] == inputSize) {
      // NCHW
      final nchw = Float32List(inputFloats.length);
      var o = 0;
      for (var c = 0; c < 3; c++) {
        for (var y = 0; y < inputSize; y++) {
          for (var x = 0; x < inputSize; x++) {
            nchw[o++] = inputFloats[(y * inputSize + x) * 3 + c];
          }
        }
      }
      inputBuffer = nchw.buffer;
    } else {
      inputBuffer = inputFloats.buffer;
    }

    interpreter.run(inputBuffer, output.buffer);
    return output;
  }

  /// Top detections after class-agnostic NMS, mapped to original coords.
  List<YoloDetection> detections(
    List<int> shape,
    Float32List flat, {
    LetterboxInfo? letterbox,
    double? minConf,
    int? maxResults,
  }) {
    final info = letterbox ?? lastLetterbox;
    final threshold = minConf ?? confThreshold;
    final limit = maxResults ?? topK;
    lastMaxScore = 0.0;
    if (flat.isEmpty || shape.length != 3) return const [];

    final d1 = shape[1];
    final d2 = shape[2];
    final channels = 4 + numClasses;
    List<YoloDetection> raw;

    // Raw Ultralytics export [1, 4+nc, anchors] e.g. [1, 13, 8400] must be
    // checked before the NMS-packed branch, which would also match d2=8400.
    if (d1 == channels) {
      raw = _parseRawYoloAll(
        flat,
        numAnchors: d2,
        channelsFirst: true,
        info: info,
        minConf: threshold,
      );
    } else if (d2 == channels) {
      raw = _parseRawYoloAll(
        flat,
        numAnchors: d1,
        channelsFirst: false,
        info: info,
        minConf: threshold,
      );
    } else if (d2 >= 6 && d2 <= 64) {
      // End-to-end NMS: [1, N, 6+] => x1,y1,x2,y2,conf,class
      raw = _parseNmsPackedAll(
        flat,
        d1,
        stride: d2,
        info: info,
        minConf: threshold,
      );
    } else {
      return const [];
    }

    raw.sort((a, b) => b.confidence.compareTo(a.confidence));
    return _nms(raw, iouThreshold: iouThreshold, maxResults: limit);
  }

  /// Map letterbox xyxy → original image xyxy and clamp.
  YoloDetection mapToOriginal({
    required int classId,
    required double confidence,
    required double x1,
    required double y1,
    required double x2,
    required double y2,
    required LetterboxInfo info,
  }) {
    double toOrigX(double x) => (x - info.padX) / info.scale;
    double toOrigY(double y) => (y - info.padY) / info.scale;

    var ox1 = toOrigX(x1);
    var oy1 = toOrigY(y1);
    var ox2 = toOrigX(x2);
    var oy2 = toOrigY(y2);

    if (ox1 > ox2) {
      final t = ox1;
      ox1 = ox2;
      ox2 = t;
    }
    if (oy1 > oy2) {
      final t = oy1;
      oy1 = oy2;
      oy2 = t;
    }

    ox1 = ox1.clamp(0.0, info.origW.toDouble());
    oy1 = oy1.clamp(0.0, info.origH.toDouble());
    ox2 = ox2.clamp(0.0, info.origW.toDouble());
    oy2 = oy2.clamp(0.0, info.origH.toDouble());

    return YoloDetection(
      classId: classId,
      confidence: confidence,
      x1: ox1,
      y1: oy1,
      x2: ox2,
      y2: oy2,
    );
  }

  static double boxIou(YoloDetection a, YoloDetection b) {
    final ix1 = math.max(a.x1, b.x1);
    final iy1 = math.max(a.y1, b.y1);
    final ix2 = math.min(a.x2, b.x2);
    final iy2 = math.min(a.y2, b.y2);
    final iw = math.max(0.0, ix2 - ix1);
    final ih = math.max(0.0, iy2 - iy1);
    final inter = iw * ih;
    if (inter <= 0) return 0.0;
    final areaA = math.max(0.0, a.width) * math.max(0.0, a.height);
    final areaB = math.max(0.0, b.width) * math.max(0.0, b.height);
    final union = areaA + areaB - inter;
    return union <= 0 ? 0.0 : inter / union;
  }

  List<YoloDetection> _nms(
    List<YoloDetection> sorted, {
    required double iouThreshold,
    required int maxResults,
  }) {
    final kept = <YoloDetection>[];
    for (final det in sorted) {
      var overlaps = false;
      for (final k in kept) {
        if (boxIou(det, k) >= iouThreshold) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        kept.add(det);
        if (kept.length >= maxResults) break;
      }
    }
    return kept;
  }

  List<YoloDetection> _parseNmsPackedAll(
    Float32List flat,
    int numDets, {
    int stride = 6,
    LetterboxInfo? info,
    required double minConf,
  }) {
    final out = <YoloDetection>[];
    for (var i = 0; i < numDets; i++) {
      final o = i * stride;
      if (o + 5 >= flat.length) break;
      final conf = flat[o + 4];
      final classId = flat[o + 5].round();
      if (conf > lastMaxScore) lastMaxScore = conf;
      if (conf < minConf) continue;
      if (classId < 0 || classId >= numClasses) continue;
      out.add(
        _finalizeBox(
          classId: classId,
          confidence: conf,
          x1: flat[o],
          y1: flat[o + 1],
          x2: flat[o + 2],
          y2: flat[o + 3],
          info: info,
        ),
      );
    }
    return out;
  }

  List<YoloDetection> _parseRawYoloAll(
    Float32List flat, {
    required int numAnchors,
    required bool channelsFirst,
    LetterboxInfo? info,
    required double minConf,
  }) {
    final channels = 4 + numClasses;
    final out = <YoloDetection>[];
    final s = coordsNormalized ? inputSize.toDouble() : 1.0;

    for (var a = 0; a < numAnchors; a++) {
      double at(int ch) => channelsFirst
          ? flat[ch * numAnchors + a]
          : flat[a * channels + ch];

      var bestClassScore = -1.0;
      var bestClass = -1;
      for (var c = 0; c < numClasses; c++) {
        final score = at(4 + c);
        if (score > bestClassScore) {
          bestClassScore = score;
          bestClass = c;
        }
      }
      if (bestClassScore > lastMaxScore) lastMaxScore = bestClassScore;
      if (bestClassScore < minConf || bestClass < 0) continue;

      final cx = at(0);
      final cy = at(1);
      final w = at(2);
      final h = at(3);

      out.add(
        _finalizeBox(
          classId: bestClass,
          confidence: bestClassScore,
          x1: (cx - w / 2) * s,
          y1: (cy - h / 2) * s,
          x2: (cx + w / 2) * s,
          y2: (cy + h / 2) * s,
          info: info,
        ),
      );
    }
    return out;
  }

  YoloDetection _finalizeBox({
    required int classId,
    required double confidence,
    required double x1,
    required double y1,
    required double x2,
    required double y2,
    LetterboxInfo? info,
  }) {
    if (info == null) {
      return YoloDetection(
        classId: classId,
        confidence: confidence,
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
      );
    }
    return mapToOriginal(
      classId: classId,
      confidence: confidence,
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      info: info,
    );
  }
}

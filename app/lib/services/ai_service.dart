import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

import '../data/disease_code_map.dart';
import 'classifier_preprocess.dart';
import 'yolo_tflite_helper.dart';

/// Bounding box in original (inference) image pixel coordinates.
class AiBox {
  const AiBox({
    required this.label,
    required this.confidence,
    required this.x1,
    required this.y1,
    required this.x2,
    required this.y2,
  });

  final String label;
  final double confidence;
  final double x1;
  final double y1;
  final double x2;
  final double y2;

  Map<String, dynamic> toJson() => {
        'label': label,
        'confidence': confidence,
        'x1': x1,
        'y1': y1,
        'x2': x2,
        'y2': y2,
      };

  static AiBox? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    return AiBox(
      label: json['label'] as String? ?? '',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      x1: (json['x1'] as num?)?.toDouble() ?? 0,
      y1: (json['y1'] as num?)?.toDouble() ?? 0,
      x2: (json['x2'] as num?)?.toDouble() ?? 0,
      y2: (json['y2'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// One disease class probability (0..1).
class DiseaseScore {
  const DiseaseScore({required this.label, required this.confidence});

  final String label;
  final double confidence;

  Map<String, dynamic> toJson() => {
        'label': label,
        'confidence': confidence,
      };

  static DiseaseScore? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    return DiseaseScore(
      label: json['label'] as String? ?? '',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
    );
  }
}

class AiResult {
  AiResult({
    required this.disease,
    required this.confidence,
    this.stage = 'unknown',
    this.boxes = const [],
    this.scores = const [],
    this.debugMaxScore = 0.0,
    this.secondaryDisease,
    this.secondaryConfidence,
  });

  final String disease;
  final double confidence;

  /// `classifier` | `healthy` | `uncertain` | `unavailable` | `error`
  final String stage;

  /// Detector regions (inference image pixels), labelled by the classifier
  /// on each crop. Empty when the detector is unavailable or the leaf is healthy.
  final List<AiBox> boxes;

  /// A different disease found in one region (Vietnamese label), if any.
  final String? secondaryDisease;
  final double? secondaryConfidence;

  /// Disease likelihoods shown to the user: 1-2 entries when a disease is
  /// found (two entries sum to 1), empty when healthy / uncertain.
  final List<DiseaseScore> scores;
  final double debugMaxScore;
}

class AiService {
  AiService._();

  static final AiService instance = AiService._();

  /// Prefer [instance]; factory keeps existing call sites working.
  factory AiService() => instance;

  static const _modelDir = 'assets/models';
  static const _configAsset = '$_modelDir/pipeline_config.json';
  static const _defaultModelFile = 'rice_leaf_cls_int8.tflite';
  static const _defaultClassIndicesFile = 'class_indices.json';
  static const _healthyClass = 'Healthy Rice Leaf';
  static const _healthyLabel = 'Khỏe mạnh';

  /// Longest edge for inference images.
  static const _inferMaxSide = 1600;

  bool _loadAttempted = false;
  Interpreter? _interpreter;
  List<String> _classes = [];
  int _inputSize = 300;
  double _rejectThreshold = 0.45;
  double _temperature = 1.0;
  List<String> _ttaViews = const ['orig'];
  String _releaseChannel = '';

  Map<String, dynamic>? _detectorConfig;
  bool _detectorLoadAttempted = false;
  Interpreter? _detector;
  YoloTfliteHelper? _yolo;
  double _cropPadding = 0.25;
  double _secondDiseaseMinConf = 0.5;

  /// True when `pipeline_config.json` marks the model as a trial release.
  bool get isTrialModel => _releaseChannel == 'trial';

  Future<Interpreter?> _ensureInterpreter() async {
    if (_interpreter != null) return _interpreter;
    if (_loadAttempted) return null;
    _loadAttempted = true;
    try {
      final config = jsonDecode(await rootBundle.loadString(_configAsset))
          as Map<String, dynamic>;
      final modelFile = config['model_file'] as String? ?? _defaultModelFile;
      final indicesFile =
          config['class_indices_file'] as String? ?? _defaultClassIndicesFile;
      final size = config['img_size'];
      if (size is List && size.isNotEmpty) {
        _inputSize = (size.first as num).toInt();
      }
      _rejectThreshold =
          (config['reject_threshold'] as num?)?.toDouble() ?? _rejectThreshold;
      _temperature =
          (config['temperature'] as num?)?.toDouble() ?? _temperature;
      final views = config['tta_views'];
      if (views is List && views.isNotEmpty) {
        _ttaViews = views.map((v) => v.toString()).toList();
      }
      _releaseChannel = config['release_channel'] as String? ?? '';
      final detector = config['detector'];
      if (detector is Map<String, dynamic> && detector['model_file'] is String) {
        _detectorConfig = detector;
        _cropPadding =
            (detector['crop_padding'] as num?)?.toDouble() ?? _cropPadding;
      }
      final rules = config['region_rules'];
      if (rules is Map<String, dynamic>) {
        _secondDiseaseMinConf =
            (rules['second_disease_min_conf'] as num?)?.toDouble() ??
                _secondDiseaseMinConf;
      }

      final indices = jsonDecode(
        await rootBundle.loadString('$_modelDir/$indicesFile'),
      ) as Map<String, dynamic>;
      _classes = labelsFromClassIndices(indices);

      final options = InterpreterOptions()..threads = 2;
      _interpreter = await Interpreter.fromAsset(
        '$_modelDir/$modelFile',
        options: options,
      );
      return _interpreter;
    } catch (e, st) {
      debugPrint('Classifier load failed: $e\n$st');
      _interpreter = null;
      return null;
    }
  }

  /// Lazily loads the YOLO detector described by `pipeline_config.json`.
  /// Call after [_ensureInterpreter] so the config has been read.
  Future<Interpreter?> _ensureDetector() async {
    if (_detector != null) return _detector;
    final cfg = _detectorConfig;
    if (cfg == null || _detectorLoadAttempted) return null;
    _detectorLoadAttempted = true;
    try {
      final names = cfg['class_names'];
      _yolo = YoloTfliteHelper(
        inputSize: (cfg['imgsz'] as num?)?.toInt() ?? 640,
        confThreshold: (cfg['conf_thresh'] as num?)?.toDouble() ?? 0.15,
        iouThreshold: (cfg['nms_iou'] as num?)?.toDouble() ?? 0.7,
        numClasses: names is List ? names.length : 9,
        coordsNormalized: cfg['coords_normalized'] as bool? ?? true,
      );
      _detector = await Interpreter.fromAsset(
        '$_modelDir/${cfg['model_file']}',
        options: InterpreterOptions()..threads = 2,
      );
      return _detector;
    } catch (e, st) {
      debugPrint('Detector load failed: $e\n$st');
      _detector = null;
      _yolo = null;
      return null;
    }
  }

  /// Detects regions on [source], then classifies each padded crop.
  /// Returns an empty list when the detector is unavailable or fails.
  Future<List<({YoloDetection det, RegionClass? region})>> _classifyRegions(
    Interpreter classifier,
    img.Image source,
  ) async {
    final detector = await _ensureDetector();
    final yolo = _yolo;
    if (detector == null || yolo == null) return const [];
    try {
      final input = yolo.preprocess(source);
      final output = yolo.run(detector, input);
      final dets = yolo.detections(
        detector.getOutputTensor(0).shape,
        output,
      );
      final out = <({YoloDetection det, RegionClass? region})>[];
      for (final det in dets) {
        final rect = paddedCropRect(
          det.x1,
          det.y1,
          det.x2,
          det.y2,
          padding: _cropPadding,
          imageWidth: source.width,
          imageHeight: source.height,
        );
        if (rect == null) continue;
        final crop = img.copyCrop(
          source,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        );
        final probs = _forward(classifier, resizeSquare(crop, _inputSize));
        if (probs.length != _classes.length) {
          out.add((det: det, region: null));
          continue;
        }
        final decision =
            decideTopClass(probs, rejectThreshold: _rejectThreshold);
        final shares =
            diseaseShares(probs, _classes.indexOf(_healthyClass));
        out.add((
          det: det,
          region: decision.accepted
              ? RegionClass(
                  modelClass: _classes[decision.index],
                  confidence: decision.confidence,
                  share: shares[decision.index],
                )
              : null,
        ));
      }
      return out;
    } catch (e, st) {
      debugPrint('detector failed: $e\n$st');
      return const [];
    }
  }

  /// Prepare image for classification in Dart (avoid compress plugin side-effects).
  /// Bakes EXIF and limits longest edge to [_inferMaxSide].
  Future<File> prepareInferenceImage(String sourcePath) async {
    final dir = await getTemporaryDirectory();
    final target =
        '${dir.path}/rg_infer_${DateTime.now().millisecondsSinceEpoch}.jpg';

    final bytes = await File(sourcePath).readAsBytes();
    var decoded = img.decodeImage(bytes);
    if (decoded == null) {
      final result = await FlutterImageCompress.compressAndGetFile(
        sourcePath,
        target,
        quality: 92,
        minWidth: _inferMaxSide,
        minHeight: _inferMaxSide,
        keepExif: false,
        autoCorrectionAngle: true,
      );
      return File(result?.path ?? sourcePath);
    }

    decoded = img.bakeOrientation(decoded);
    final maxSide =
        decoded.width > decoded.height ? decoded.width : decoded.height;
    if (maxSide > _inferMaxSide) {
      final scale = _inferMaxSide / maxSide;
      decoded = img.copyResize(
        decoded,
        width: (decoded.width * scale).round().clamp(1, _inferMaxSide),
        height: (decoded.height * scale).round().clamp(1, _inferMaxSide),
        interpolation: img.Interpolation.linear,
      );
    }

    final jpg = img.encodeJpg(decoded, quality: 92);
    final out = File(target);
    await out.writeAsBytes(jpg, flush: true);
    return out;
  }

  /// Smaller JPEG for local storage / gallery history (after inference).
  Future<File> compressImage(String sourcePath) async {
    final dir = await getTemporaryDirectory();
    final target =
        '${dir.path}/rg_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final result = await FlutterImageCompress.compressAndGetFile(
      sourcePath,
      target,
      quality: 85,
      minWidth: 1024,
      minHeight: 1024,
      keepExif: false,
      autoCorrectionAngle: true,
    );
    return File(result?.path ?? sourcePath);
  }

  Future<AiResult> classify(File imageFile) async {
    final interpreter = await _ensureInterpreter();
    if (interpreter == null || _classes.isEmpty) {
      return AiResult(disease: '', confidence: 0, stage: 'unavailable');
    }

    try {
      final decoded = img.decodeImage(await imageFile.readAsBytes());
      if (decoded == null) {
        return AiResult(disease: '', confidence: 0, stage: 'error');
      }
      final source = img.bakeOrientation(decoded);
      final input = resizeSquare(source, _inputSize);

      final vectors = <List<double>>[];
      for (final view in ttaViews(input, _ttaViews)) {
        final probs = _forward(interpreter, view);
        if (probs.length == _classes.length) vectors.add(probs);
      }
      final mean = meanClassScores(vectors);
      if (mean.isEmpty) {
        return AiResult(disease: '', confidence: 0, stage: 'error');
      }

      final regions = await _classifyRegions(interpreter, source);
      final view = buildDiseaseView(
        classes: _classes,
        fullProbs: mean,
        regions: [for (final r in regions) r.region],
        healthyClass: _healthyClass,
        rejectThreshold: _rejectThreshold,
        secondMinConf: _secondDiseaseMinConf,
      );
      final boxes = <AiBox>[
        for (final i in view.regionIndices)
          AiBox(
            label: viLabelForModelClass(regions[i].region!.modelClass),
            confidence: regions[i].region!.share,
            x1: regions[i].det.x1,
            y1: regions[i].det.y1,
            x2: regions[i].det.x2,
            y2: regions[i].det.y2,
          ),
      ];
      final maxScore = mean.reduce((a, b) => a > b ? a : b);

      switch (view.stage) {
        case 'healthy':
          return AiResult(
            disease: _healthyLabel,
            confidence: view.primaryPercent,
            stage: 'healthy',
            debugMaxScore: maxScore,
          );
        case 'uncertain':
          return AiResult(
            disease: '',
            confidence: maxScore,
            stage: 'uncertain',
            boxes: boxes,
            debugMaxScore: maxScore,
          );
      }

      final primaryLabel = viLabelForModelClass(view.primaryClass);
      final secondaryLabel = view.secondaryClass == null
          ? null
          : viLabelForModelClass(view.secondaryClass!);
      return AiResult(
        disease: primaryLabel,
        confidence: view.primaryPercent,
        stage: 'classifier',
        boxes: boxes,
        scores: [
          DiseaseScore(label: primaryLabel, confidence: view.primaryPercent),
          if (secondaryLabel != null)
            DiseaseScore(
              label: secondaryLabel,
              confidence: view.secondaryPercent ?? 0,
            ),
        ],
        debugMaxScore: maxScore,
        secondaryDisease: secondaryLabel,
        secondaryConfidence: view.secondaryPercent,
      );
    } catch (e, st) {
      debugPrint('classify failed: $e\n$st');
      return AiResult(disease: '', confidence: 0, stage: 'error');
    }
  }

  /// One forward pass. Pixels are fed as 0..255 (EfficientNet rescales in-graph);
  /// quantized tensors use their own scale / zero point.
  List<double> _forward(Interpreter interpreter, img.Image view) {
    final inTensor = interpreter.getInputTensor(0);
    final outTensor = interpreter.getOutputTensor(0);
    final n = _inputSize * _inputSize * 3;

    final pixels = Float32List(n);
    var i = 0;
    for (var y = 0; y < _inputSize; y++) {
      for (var x = 0; x < _inputSize; x++) {
        final p = view.getPixel(x, y);
        pixels[i++] = p.r.toDouble();
        pixels[i++] = p.g.toDouble();
        pixels[i++] = p.b.toDouble();
      }
    }

    final Uint8List inputBytes;
    final inParams = inTensor.params;
    switch (inTensor.type) {
      case TensorType.int8:
        final q = Int8List(n);
        for (var j = 0; j < n; j++) {
          q[j] = _quantize(pixels[j], inParams, -128, 127);
        }
        inputBytes = q.buffer.asUint8List();
      case TensorType.uint8:
        final q = Uint8List(n);
        for (var j = 0; j < n; j++) {
          q[j] = _quantize(pixels[j], inParams, 0, 255);
        }
        inputBytes = q;
      default:
        inputBytes = pixels.buffer.asUint8List();
    }

    final outBytes = Uint8List(outTensor.numBytes());
    interpreter.run(inputBytes, outBytes);

    final count = outTensor.numElements();
    final outParams = outTensor.params;
    final raw = List<double>.filled(count, 0);
    switch (outTensor.type) {
      case TensorType.int8:
        final v = outBytes.buffer.asInt8List(0, count);
        for (var j = 0; j < count; j++) {
          raw[j] = _dequantize(v[j], outParams);
        }
      case TensorType.uint8:
        for (var j = 0; j < count; j++) {
          raw[j] = _dequantize(outBytes[j], outParams);
        }
      default:
        final v = outBytes.buffer.asFloat32List(0, count);
        for (var j = 0; j < count; j++) {
          raw[j] = v[j];
        }
    }

    return looksLikeProbabilities(raw, tolerance: 0.1)
        ? normalizeScores(raw)
        : softmax(raw, temperature: _temperature);
  }

  static int _quantize(double x, QuantizationParams p, int lo, int hi) {
    final scale = p.scale == 0 ? 1.0 : p.scale;
    return (x / scale + p.zeroPoint).round().clamp(lo, hi);
  }

  static double _dequantize(int q, QuantizationParams p) {
    final scale = p.scale == 0 ? 1.0 : p.scale;
    return (q - p.zeroPoint) * scale;
  }

  void dispose() {
    _interpreter?.close();
    _interpreter = null;
    _loadAttempted = false;
    _detector?.close();
    _detector = null;
    _yolo = null;
    _detectorLoadAttempted = false;
  }
}

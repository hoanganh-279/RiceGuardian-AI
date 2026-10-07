import 'dart:io';
import 'dart:ui' as ui;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/field_model.dart';
import '../../providers/app_providers.dart';
import '../../services/ai_service.dart';
import '../../services/disease_catalog_service.dart';
import '../../widgets/alert_badge.dart';
import '../../widgets/camera/capture_viewport.dart';
import '../../widgets/camera/detection_overlay.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/rice/rice.dart';

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  FieldModel? _selectedField;
  bool _initializing = false;
  bool _initStarted = false;
  bool _processing = false;
  String? _cameraError;
  String? _actionError;

  bool get _cameraReady =>
      _controller != null && _controller!.value.isInitialized;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final shell = StatefulNavigationShell.maybeOf(context);
    final onCameraTab = shell == null || shell.currentIndex == 2;
    if (onCameraTab && !_initStarted) {
      _initStarted = true;
      _init();
    }
  }

  Future<void> _init() async {
    setState(() {
      _initializing = true;
      _cameraError = null;
      _actionError = null;
    });
    try {
      final data = context.read<AppDataProvider>();
      if (data.fields.isEmpty) {
        await data.refreshFields();
      }
      if (!mounted) return;
      final fields = data.fields;
      if (fields.isNotEmpty) {
        _selectedField ??= fields.first;
      }

      try {
        _cameras = await availableCameras();
        if (_cameras.isEmpty) {
          throw Exception('Không tìm thấy camera.');
        }
        await _controller?.dispose();
        _controller = CameraController(
          _cameras.first,
          ResolutionPreset.medium,
          enableAudio: false,
        );
        await _controller!.initialize();
        if (!mounted) return;
        setState(() {
          _cameraError = null;
          _initializing = false;
        });
      } catch (error) {
        await _controller?.dispose();
        _controller = null;
        if (!mounted) return;
        setState(() {
          _cameraError = errorMessage(error);
          _initializing = false;
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _cameraError = errorMessage(error);
        _initializing = false;
      });
    }
  }

  Future<void> _processImagePath(String path) async {
    if (_selectedField == null) return;
    setState(() {
      _processing = true;
      _actionError = null;
    });
    try {
      final ai = AiService.instance;
      final inferFile = await ai.prepareInferenceImage(path);
      final result = await ai.classify(inferFile);
      final displayFile = await ai.compressImage(inferFile.path);
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition();
      } catch (_) {}
      if (!mounted) return;
      context.push('/camera/preview', extra: {
        'path': inferFile.path,
        'savePath': displayFile.path,
        'field': _selectedField,
        'disease': result.disease,
        'confidence': result.confidence,
        'stage': result.stage,
        'boxes': result.boxes.map((b) => b.toJson()).toList(),
        'scores': result.scores.map((s) => s.toJson()).toList(),
        'secondaryDisease': result.secondaryDisease,
        'secondaryConfidence': result.secondaryConfidence,
        'lat': position?.latitude,
        'lng': position?.longitude,
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _actionError = errorMessage(error));
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _capture() async {
    if (!_cameraReady || _selectedField == null) return;
    try {
      final photo = await _controller!.takePicture();
      await _processImagePath(photo.path);
    } catch (error) {
      if (!mounted) return;
      setState(() => _actionError = errorMessage(error));
    }
  }

  Future<void> _pickFromGallery() async {
    if (_selectedField == null || _processing) return;
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );
      if (picked == null) return;
      await _processImagePath(picked.path);
    } catch (error) {
      if (!mounted) return;
      setState(() => _actionError = errorMessage(error));
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fields = context.watch<AppDataProvider>().fields;
    final canUseGallery =
        !_processing && fields.isNotEmpty && _selectedField != null;
    final canCapture = canUseGallery && _cameraReady;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chụp ảnh nhận diện bệnh'),
        leading: IconButton(
          tooltip: 'Trang chủ',
          icon: const Icon(Icons.home_outlined),
          onPressed: () => context.go('/home'),
        ),
      ),
      body: (!_initStarted || _initializing)
          ? const LoadingView(message: 'Đang mở camera...')
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (fields.isEmpty)
                      const RiceCard(
                        padding: EdgeInsets.symmetric(vertical: 4),
                        child: RiceEmptyState(
                          message: 'Chưa có thửa ruộng được gán.',
                          icon: Icons.map_outlined,
                        ),
                      )
                    else
                      DropdownButtonFormField<FieldModel>(
                        initialValue: _selectedField,
                        decoration: const InputDecoration(
                          labelText: 'Chọn thửa ruộng',
                          prefixIcon: Icon(Icons.grass, color: AppColors.primary),
                        ),
                        items: fields
                            .map(
                              (f) => DropdownMenuItem(
                                value: f,
                                child: Text(f.name),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _selectedField = v),
                      ),
                    const SizedBox(height: 16),
                    Expanded(
                      child: CaptureViewport(
                        cameraReady: _cameraReady,
                        controller: _controller,
                        cameraError: _cameraError,
                        onRetry: _init,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Chụp hoặc tải ảnh cận cảnh lá lúa có biểu hiện bệnh',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        height: 1.35,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        TipChip(icon: Icons.light_mode_outlined, label: 'Đủ sáng'),
                        TipChip(icon: Icons.zoom_in, label: 'Chụp gần'),
                        TipChip(
                          icon: Icons.center_focus_strong_outlined,
                          label: 'Lá rõ nét',
                        ),
                      ],
                    ),
                    if (_actionError != null) ...[
                      const SizedBox(height: 8),
                      RiceErrorBanner(message: _actionError!),
                    ],
                    const SizedBox(height: 16),
                    RicePrimaryButton(
                      label: _processing
                          ? 'Đang xử lý AI...'
                          : 'Chụp và nhận diện',
                      icon: Icons.photo_camera,
                      loading: _processing,
                      onPressed: canCapture ? _capture : null,
                    ),
                    const SizedBox(height: 12),
                    RiceOutlinedButton(
                      label: 'Tải ảnh từ thư viện',
                      icon: Icons.photo_library_outlined,
                      onPressed: canUseGallery ? _pickFromGallery : null,
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class PhotoPreviewScreen extends StatefulWidget {
  const PhotoPreviewScreen({
    super.key,
    required this.imagePath,
    required this.field,
    required this.disease,
    required this.confidence,
    this.savePath,
    this.stage = 'unknown',
    this.boxes = const [],
    this.scores = const [],
    this.secondaryDisease,
    this.secondaryConfidence,
    this.lat,
    this.lng,
  });

  final String imagePath;
  final String? savePath;
  final FieldModel field;
  final String disease;
  final double confidence;
  final String stage;
  final List<AiBox> boxes;
  final List<DiseaseScore> scores;
  final String? secondaryDisease;
  final double? secondaryConfidence;
  final double? lat;
  final double? lng;

  @override
  State<PhotoPreviewScreen> createState() => _PhotoPreviewScreenState();
}

class _PhotoPreviewScreenState extends State<PhotoPreviewScreen> {
  bool _saving = false;
  String? _error;
  bool _saved = false;
  Size? _imageSize;

  @override
  void initState() {
    super.initState();
    _loadImageSize();
  }

  Future<void> _loadImageSize() async {
    try {
      final bytes = await File(widget.imagePath).readAsBytes();
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      if (!mounted) return;
      setState(() {
        _imageSize = Size(
          frame.image.width.toDouble(),
          frame.image.height.toDouble(),
        );
      });
      frame.image.dispose();
    } catch (_) {}
  }

  Future<void> _saveLocal() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final data = context.read<AppDataProvider>();
      final photo = await data.saveLocalPhoto(
        filePath: widget.savePath ?? widget.imagePath,
        field: widget.field,
        disease: widget.disease,
        confidence: widget.confidence,
        lat: widget.lat,
        lng: widget.lng,
      );
      setState(() {
        _saved = true;
        _saving = false;
        if (photo.syncStatus == 'error') {
          _error = data.syncMessage ??
              'Đã lưu trên máy nhưng chưa đồng bộ server. Kéo làm mới thông báo để thử lại.';
        }
      });
    } catch (error) {
      setState(() {
        _error = errorMessage(error);
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final failed = widget.stage == 'unavailable' || widget.stage == 'error';
    final isUncertain = widget.stage == 'uncertain' ||
        (!failed && widget.disease.trim().isEmpty);
    final hasResult = !failed && !isUncertain;
    final isHealthy = hasResult && widget.disease == 'Khỏe mạnh';
    final color = !hasResult
        ? AppColors.textSecondary
        : (isHealthy ? AppColors.primary : AppColors.danger);
    final title = failed
        ? 'Chưa có kết quả'
        : isUncertain
            ? 'Chưa nhận diện rõ vùng bệnh'
            : (isHealthy
                ? 'Cây trông khỏe mạnh'
                : 'Phát hiện: ${widget.disease}');
    final statusIcon = !hasResult
        ? Icons.help_outline
        : (isHealthy ? Icons.check_circle : Icons.coronavirus_outlined);
    final catalog = hasResult && !isHealthy
        ? DiseaseCatalogService.instance.lookupByNameVi(widget.disease)
        : null;
    final isTrial = AiService.instance.isTrialModel;
    final secondaryPct = widget.secondaryConfidence == null
        ? ''
        : ' (${(widget.secondaryConfidence! * 100).round()}%)';
    final secondaryText = 'Có thể kèm: ${widget.secondaryDisease}$secondaryPct';

    return Scaffold(
      appBar: AppBar(title: const Text('Kết quả nhận diện')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: DetectionImage(
              imagePath: widget.imagePath,
              imageSize: _imageSize,
              boxes: widget.boxes,
              strokeColor: color,
              primaryLabel: hasResult && !isHealthy ? widget.disease : null,
            ),
          ),
          const SizedBox(height: 16),
          if (failed) ...[
            RiceErrorBanner(
              message: widget.stage == 'unavailable'
                  ? 'Chưa có mô hình nhận diện trên máy.'
                  : 'Không nhận diện được ảnh này. Hãy thử lại.',
            ),
            const SizedBox(height: 16),
          ],
          RiceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(statusIcon, color: color),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (hasResult)
                  DiseaseSummaryChip(
                    name: widget.disease,
                    confidence: widget.confidence,
                    healthy: isHealthy,
                  ),
                if (hasResult && !isHealthy && widget.secondaryDisease != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(
                        Icons.add_circle_outline,
                        size: 18,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          secondaryText,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                if (isUncertain)
                  const Text(
                    'Thử chụp gần hơn, đủ sáng, tập trung vào vết bệnh trên lá.',
                    style: TextStyle(fontSize: 14, height: 1.4),
                  ),
                const SizedBox(height: 8),
                const AlertTypeChip(isEnvironment: false),
                const SizedBox(height: 8),
                Text(
                  'Thửa: ${widget.field.name}',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
                if (isTrial && !failed) ...[
                  const SizedBox(height: 4),
                  const Text(
                    'Mô hình thử nghiệm — kết quả chỉ mang tính tham khảo',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (hasResult && !isHealthy && widget.scores.isNotEmpty) ...[
            const SizedBox(height: 16),
            DiseaseScoreBars(
              scores: widget.scores,
              highlightedLabel: widget.disease,
              highlightColor: color,
            ),
          ],
          if (hasResult && !isHealthy) ...[
            const SizedBox(height: 16),
            RiceCard(
              child: catalog != null
                  ? DiseaseGuideBlock(entry: catalog)
                  : const Text(
                      'Chưa có hướng dẫn cho bệnh này.',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            if (_saved)
              InfoBanner(icon: Icons.info_outline, message: _error!)
            else
              RiceErrorBanner(message: _error!),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!hasResult)
                RicePrimaryButton(
                  label: 'Chụp lại',
                  icon: Icons.photo_camera_outlined,
                  onPressed: () => context.go('/camera'),
                )
              else ...[
                if (_saved)
                  const InfoBanner(message: 'Đã lưu trên máy')
                else
                  RicePrimaryButton(
                    label: 'Lưu trên máy',
                    loading: _saving,
                    onPressed: _saveLocal,
                  ),
                const SizedBox(height: 8),
                RiceOutlinedButton(
                  label: 'Chụp lại',
                  icon: Icons.photo_camera_outlined,
                  onPressed: () => context.go('/camera'),
                ),
              ],
              TextButton(
                onPressed: () => context.go('/home'),
                child: const Text('Về trang chủ'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

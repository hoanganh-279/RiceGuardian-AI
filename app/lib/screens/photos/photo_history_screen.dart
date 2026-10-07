import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/photo_model.dart';
import '../../providers/app_providers.dart';
import '../../services/disease_catalog_service.dart';
import '../../utils/date_display.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/rice/rice.dart';

enum _PhotoFilter { all, disease, healthy }

class PhotoHistoryScreen extends StatefulWidget {
  const PhotoHistoryScreen({super.key});

  @override
  State<PhotoHistoryScreen> createState() => _PhotoHistoryScreenState();
}

class _PhotoHistoryScreenState extends State<PhotoHistoryScreen> {
  final _photos = <PhotoModel>[];
  int _page = 1;
  bool _loading = true;
  bool _hasMore = true;
  String? _error;
  _PhotoFilter _filter = _PhotoFilter.all;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool refresh = false}) async {
    if (refresh) {
      _page = 1;
      _hasMore = true;
      _photos.clear();
    }
    if (!_hasMore) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result =
          await context.read<AppDataProvider>().loadPhotos(page: _page);
      setState(() {
        _photos.addAll(result.items);
        _hasMore = result.hasMore;
        _page += 1;
        _loading = false;
      });
    } catch (error) {
      setState(() {
        _error = errorMessage(error);
        _loading = false;
      });
    }
  }

  Widget _thumb(PhotoModel photo, {double? size, double height = 220}) {
    final broken = Container(
      width: size ?? double.infinity,
      height: size ?? height,
      color: AppColors.border,
      child: const Icon(Icons.broken_image, color: AppColors.textSecondary),
    );
    if (photo.imageUrl.isEmpty ||
        !photo.isLocalFile ||
        !File(photo.imageUrl).existsSync()) {
      return broken;
    }
    return Image.file(
      File(photo.imageUrl),
      width: size ?? double.infinity,
      height: size ?? height,
      fit: BoxFit.cover,
    );
  }

  Widget _resultChip(PhotoModel photo) {
    if (photo.disease.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.help_outline, size: 18, color: AppColors.textSecondary),
            SizedBox(width: 6),
            Text(
              'Chưa có kết quả',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
          ],
        ),
      );
    }
    return DiseaseSummaryChip(
      name: photo.disease,
      confidence: photo.confidence,
      healthy: photo.disease == 'Khỏe mạnh',
    );
  }

  void _openDetail(PhotoModel photo) {
    final isDisease =
        photo.disease.isNotEmpty && photo.disease != 'Khỏe mạnh';
    final catalog = isDisease
        ? DiseaseCatalogService.instance.lookupByNameVi(photo.disease)
        : null;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: _thumb(photo),
            ),
            const SizedBox(height: 12),
            Align(alignment: Alignment.centerLeft, child: _resultChip(photo)),
            const SizedBox(height: 8),
            Text(
              '${photo.fieldName} · ${formatDateTime(photo.capturedAt)}',
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
            if (isDisease) ...[
              const SizedBox(height: 16),
              if (catalog != null)
                DiseaseGuideBlock(entry: catalog)
              else
                const Text(
                  'Chưa có hướng dẫn cho bệnh này.',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
            const SizedBox(height: 16),
            RiceOutlinedButton(
              label: 'Đóng',
              onPressed: () => Navigator.pop(ctx),
            ),
          ],
        ),
      ),
    );
  }

  List<PhotoModel> get _visible {
    switch (_filter) {
      case _PhotoFilter.disease:
        return _photos
            .where((p) => p.disease.isNotEmpty && p.disease != 'Khỏe mạnh')
            .toList();
      case _PhotoFilter.healthy:
        return _photos.where((p) => p.disease == 'Khỏe mạnh').toList();
      case _PhotoFilter.all:
        return _photos;
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visible;
    return Scaffold(
      appBar: AppBar(title: const Text('Lịch sử ảnh')),
      body: _error != null && _photos.isEmpty
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: Align(
                alignment: Alignment.topCenter,
                child: RiceErrorBanner(
                  message: _error!,
                  onRetry: () => _load(refresh: true),
                ),
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: RiceFilterChips<_PhotoFilter>(
                    options: const [
                      ChoiceOption(value: _PhotoFilter.all, label: 'Tất cả'),
                      ChoiceOption(
                        value: _PhotoFilter.disease,
                        label: 'Có bệnh',
                      ),
                      ChoiceOption(
                        value: _PhotoFilter.healthy,
                        label: 'Khỏe mạnh',
                      ),
                    ],
                    selected: _filter,
                    onSelected: (v) => setState(() => _filter = v),
                  ),
                ),
                Expanded(
                  child: RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () => _load(refresh: true),
                    child: _loading && _photos.isEmpty
                        ? ListView(
                            padding: const EdgeInsets.all(16),
                            children: [RiceSkeleton.list(count: 4, height: 96)],
                          )
                        : visible.isEmpty && !_hasMore
                            ? ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: [
                                  const SizedBox(height: 80),
                                  RiceEmptyState(
                                    message:
                                        'Chưa có ảnh nào. Hãy chụp và lưu trên máy.',
                                    icon: Icons.photo_library_outlined,
                                    actionLabel: 'Chụp ảnh kiểm bệnh',
                                    onAction: () => context.go('/camera'),
                                  ),
                                ],
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(16),
                                physics: const AlwaysScrollableScrollPhysics(),
                                itemCount: visible.length + (_hasMore ? 1 : 0),
                                itemBuilder: (context, index) {
                                  if (index >= visible.length) {
                                    if (!_loading) _load();
                                    return const Padding(
                                      padding: EdgeInsets.all(16),
                                      child: Center(
                                        child: CircularProgressIndicator(
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    );
                                  }
                                  final photo = visible[index];
                                  return RiceCard(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.all(12),
                                    onTap: () => _openDetail(photo),
                                    child: Row(
                                      children: [
                                        ClipRRect(
                                          borderRadius:
                                              BorderRadius.circular(12),
                                          child: _thumb(photo, size: 72),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                photo.fieldName,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 15,
                                                ),
                                              ),
                                              const SizedBox(height: 6),
                                              _resultChip(photo),
                                              const SizedBox(height: 4),
                                              Text(
                                                formatDateTime(
                                                  photo.capturedAt,
                                                ),
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  color:
                                                      AppColors.textSecondary,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const Icon(
                                          Icons.chevron_right,
                                          color: AppColors.textSecondary,
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                  ),
                ),
              ],
            ),
    );
  }
}

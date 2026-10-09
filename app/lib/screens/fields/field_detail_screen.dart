import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../constants/sensor_labels.dart';
import '../../models/alert_model.dart';
import '../../models/field_model.dart';
import '../../models/photo_model.dart';
import '../../providers/app_providers.dart';
import '../../providers/mqtt_provider.dart';
import '../../services/mqtt_service.dart';
import '../../utils/metric_display.dart';
import '../../widgets/alert_badge.dart';
import '../../widgets/rice/rice.dart';
import '../field_log/field_log_sheet.dart';
import 'fields_list_screen.dart' show alertsForField, highestRisk;

String _mqttStatusLabel(MqttDataProvider mqtt) {
  switch (mqtt.status) {
    case MqttLinkStatus.connected:
      return 'Trực tuyến';
    case MqttLinkStatus.connecting:
      return 'Đang kết nối';
    case MqttLinkStatus.disconnected:
      return 'Mất kết nối';
    case MqttLinkStatus.idle:
      return 'Chưa bật';
  }
}

String _ageText(DateTime at) {
  final diff = DateTime.now().difference(at);
  if (diff.inSeconds < 60) return '${diff.inSeconds}s';
  if (diff.inMinutes < 60) return '${diff.inMinutes}p';
  return '${diff.inHours}h';
}

const _sensorIcons = <String, IconData>{
  'tempC': Icons.thermostat,
  'humidityPct': Icons.water_drop_outlined,
  'waterCm': Icons.waves,
  'lightLux': Icons.light_mode_outlined,
  'soilMoisturePct': Icons.grass,
};

class FieldDetailScreen extends StatefulWidget {
  const FieldDetailScreen({super.key, required this.field});

  final FieldModel field;

  @override
  State<FieldDetailScreen> createState() => _FieldDetailScreenState();
}

class _FieldDetailScreenState extends State<FieldDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final data = context.read<AppDataProvider>();
      if (data.alerts.isEmpty) data.refreshAlerts();
      if (data.photos.isEmpty) _loadPhotos(data);
    });
  }

  Future<void> _loadPhotos(AppDataProvider data) async {
    try {
      await data.loadPhotos(page: 1);
    } catch (_) {}
  }

  void _openLogSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => FieldLogSheet(fieldId: widget.field.id),
    );
  }

  @override
  Widget build(BuildContext context) {
    final field = widget.field;
    final data = context.watch<AppDataProvider>();
    final mqtt = context.watch<MqttDataProvider>();
    final fieldAlerts = alertsForField(data.alerts, field);
    final fieldPhotos = data.photos
        .where((p) => p.fieldId == field.id)
        .take(4)
        .toList();
    final reading = mqtt.readingForField(field.id, data.fields);

    return Scaffold(
      appBar: AppBar(title: Text(field.name, overflow: TextOverflow.ellipsis)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _FieldCoverHero(field: field),
          const SizedBox(height: 16),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _FactTile(
                    icon: Icons.eco_outlined,
                    label: 'Giống lúa',
                    value: field.variety.isEmpty ? metricDash : field.variety,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _FactTile(
                    icon: Icons.calendar_month_outlined,
                    label: 'Mùa vụ',
                    value: field.currentSeason.isEmpty
                        ? metricDash
                        : field.currentSeason,
                  ),
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: _FactTile(
                    icon: Icons.square_foot,
                    label: 'Diện tích',
                    value: '$metricDash ha',
                  ),
                ),
              ],
            ),
          ),
          if (field.blbDiseasePct != null) ...[
            const SizedBox(height: 8),
            const Text(
              'Diện tích bệnh BLB: $metricDash',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
          const SizedBox(height: 16),
          _StatusCard(alerts: fieldAlerts),
          const SizedBox(height: 16),
          RiceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Text(
                      'Cảm biến IoT',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    if (mqtt.enabled) ...[
                      Icon(
                        mqtt.status == MqttLinkStatus.connected
                            ? Icons.circle
                            : Icons.circle_outlined,
                        size: 12,
                        color: mqtt.status == MqttLinkStatus.connected
                            ? AppColors.primary
                            : AppColors.secondary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _mqttStatusLabel(mqtt),
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 2.2,
                  children: [
                    for (final m in kSensorMetrics)
                      SensorTile(
                        icon: _sensorIcons[m.key] ?? Icons.sensors,
                        label: m.short,
                        value: formatMetricValue(
                          m.key,
                          reading?.valueFor(m.key),
                        ),
                        unit: m.unit,
                      ),
                  ],
                ),
                if (reading != null) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(
                        Icons.router_outlined,
                        size: 16,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Node ${reading.nodeId} · RSSI ${reading.rssi ?? metricDash} dBm · ${reading.hop ?? 0} hop · cập nhật ${_ageText(reading.recordedAt)} trước',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                if (!mqtt.enabled) ...[
                  const SizedBox(height: 12),
                  const OfflineBanner(
                    message:
                        'Chưa bật kết nối trạm LoRa. Vào Cài đặt để cấu hình broker MQTT.',
                  ),
                  const SizedBox(height: 6),
                ] else if (mqtt.status == MqttLinkStatus.disconnected) ...[
                  const SizedBox(height: 12),
                  const OfflineBanner(
                    message: 'Mất kết nối trạm LoRa. Kiểm tra IP/port broker.',
                  ),
                  const SizedBox(height: 6),
                ] else if (reading == null) ...[
                  const SizedBox(height: 12),
                  const OfflineBanner(
                    message: 'Trạm chưa gửi dữ liệu mới cho thửa này.',
                  ),
                  const SizedBox(height: 6),
                ],
                if (mqtt.enabled) ...[
                  const SizedBox(height: 6),
                  const Text(
                    'Chỉ nhận dữ liệu khi app đang mở màn hình.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          _RecentPhotosCard(photos: fieldPhotos),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: RicePrimaryButton(
            label: 'Ghi nhật ký canh tác',
            icon: Icons.agriculture,
            onPressed: _openLogSheet,
          ),
        ),
      ),
    );
  }
}

class _FactTile extends StatelessWidget {
  const _FactTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.primary),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.alerts});

  final List<AlertModel> alerts;

  @override
  Widget build(BuildContext context) {
    final risk = highestRisk(alerts);
    final latest = alerts.isEmpty ? null : alerts.first;
    return RiceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Tình trạng',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          if (latest == null)
            const Row(
              children: [
                Icon(Icons.check_circle_outline, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Chưa có cảnh báo',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            )
          else ...[
            Row(
              children: [
                AlertBadge(riskLevel: risk ?? latest.riskLevel),
                const SizedBox(width: 8),
                Text(
                  '${alerts.length} cảnh báo',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              latest.title,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
            if (latest.summary.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                latest.summary,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.go('/alerts'),
                child: const Text('Xem cảnh báo'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RecentPhotosCard extends StatelessWidget {
  const _RecentPhotosCard({required this.photos});

  final List<PhotoModel> photos;

  @override
  Widget build(BuildContext context) {
    return RiceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionHeader(
            title: 'Ảnh gần đây',
            onAction: photos.isEmpty ? null : () => context.push('/photos'),
          ),
          if (photos.isEmpty) ...[
            const Text(
              'Chưa có ảnh chụp cho thửa này',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            RiceOutlinedButton(
              label: 'Chụp ảnh',
              icon: Icons.photo_camera_outlined,
              onPressed: () => context.go('/camera'),
            ),
          ] else
            Row(
              children: [
                for (var i = 0; i < 4; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: i < photos.length
                        ? AspectRatio(
                            aspectRatio: 1,
                            child: _PhotoThumb(photo: photos[i]),
                          )
                        : const SizedBox.shrink(),
                  ),
                ],
              ],
            ),
        ],
      ),
    );
  }
}

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({required this.photo});

  final PhotoModel photo;

  @override
  Widget build(BuildContext context) {
    final broken = Container(
      color: AppColors.border,
      child: const Icon(Icons.broken_image, color: AppColors.textSecondary),
    );
    Widget image;
    if (photo.imageUrl.isEmpty) {
      image = broken;
    } else if (photo.isLocalFile) {
      final file = File(photo.imageUrl);
      image = file.existsSync() ? Image.file(file, fit: BoxFit.cover) : broken;
    } else {
      image = Image.network(
        photo.imageUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => broken,
      );
    }
    return ClipRRect(borderRadius: BorderRadius.circular(12), child: image);
  }
}

class _FieldCoverHero extends StatelessWidget {
  const _FieldCoverHero({required this.field});

  final FieldModel field;

  @override
  Widget build(BuildContext context) {
    final coverUrl = field.coverUrl;
    final maskUrl = field.blbMaskUrl;
    final placeholder = Container(
      color: AppColors.primary.withValues(alpha: 0.12),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(16),
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.image_outlined, color: AppColors.primary, size: 32),
          SizedBox(height: 8),
          Text(
            'Chưa có ảnh thửa (UAV/upload)',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: coverUrl == null || coverUrl.isEmpty
            ? placeholder
            : Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    coverUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => placeholder,
                  ),
                  if (maskUrl != null && maskUrl.isNotEmpty) ...[
                    Opacity(
                      opacity: 0.45,
                      child: Image.network(
                        maskUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    ),
                    Positioned(
                      left: 8,
                      bottom: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'BLB: $metricDash%',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.danger,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../models/mqtt_config.dart';
import '../../providers/app_providers.dart';
import '../../providers/mqtt_provider.dart';
import '../../services/mqtt_service.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/rice/rice.dart';

const _defaultPort = 1883;
const _defaultTlsPort = 8883;

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _host;
  late final TextEditingController _port;
  late final TextEditingController _username;
  late final TextEditingController _password;
  late final TextEditingController _topic;
  bool _tls = false;
  bool _enabled = false;
  bool _loading = true;
  bool _notifications = true;

  @override
  void initState() {
    super.initState();
    _host = TextEditingController();
    _port = TextEditingController(text: '$_defaultPort');
    _username = TextEditingController();
    _password = TextEditingController();
    _topic = TextEditingController();
    _load();
  }

  @override
  void dispose() {
    _host.dispose();
    _port.dispose();
    _username.dispose();
    _password.dispose();
    _topic.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final data = context.read<AppDataProvider>();
    final mqtt = context.read<MqttDataProvider>();
    await data.loadSettings();
    await mqtt.bootstrap();
    if (!mounted) return;
    final settings = data.settings;
    final config = mqtt.config;
    setState(() {
      _notifications = settings?['notificationsEnabled'] as bool? ?? true;
      _host.text = config.host;
      _port.text = '${config.port}';
      _tls = config.tls;
      _username.text = config.username;
      _password.text = config.password;
      _topic.text = config.topic;
      _enabled = config.enabled;
      _loading = false;
    });
  }

  Future<void> _saveNotifications(bool value) async {
    setState(() => _notifications = value);
    await context.read<AppDataProvider>().saveSettings({
      'notificationsEnabled': value,
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(value ? 'Đã bật thông báo' : 'Đã tắt thông báo'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _saveMqtt() async {
    final host = _host.text.trim();
    final port = int.tryParse(_port.text.trim()) ?? _defaultPort;
    if (_enabled && host.isEmpty) {
      _showMessage('Nhập địa chỉ IP của broker (vd. 192.168.1.10).');
      return;
    }
    if (port <= 0 || port > 65535) {
      _showMessage('Cổng kết nối không hợp lệ (1–65535).');
      return;
    }
    if (_enabled && _topic.text.trim().isEmpty) {
      _showMessage('Nhập topic MQTT để nhận dữ liệu.');
      return;
    }
    final previous = context.read<MqttDataProvider>().config;
    final config = MqttConfig(
      host: host,
      port: port,
      tls: _tls,
      username: _username.text.trim(),
      password: _password.text,
      topic: _topic.text.trim().isEmpty ? previous.topic : _topic.text.trim(),
      clientId: previous.clientId.isNotEmpty
          ? previous.clientId
          : _generateClientId(),
      enabled: _enabled,
      fieldNodeMap: previous.fieldNodeMap,
    );
    await context.read<MqttDataProvider>().applyConfig(config);
    if (!mounted) return;
    _showMessage(_enabled ? 'Đã lưu và kết nối trạm.' : 'Đã tắt kết nối trạm.');
  }

  String _generateClientId() =>
      'rg-app-${DateTime.now().millisecondsSinceEpoch.toRadixString(16)}';

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 3)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mqtt = context.watch<MqttDataProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Cài đặt')),
      body: _loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const SectionHeader(title: 'Kết nối trạm LoRa (MQTT)'),
                const RiceCard(
                  child: InfoBanner(
                    icon: Icons.cast,
                    message:
                        'Nhập địa chỉ broker MQTT (chạy trên Raspberry Pi gateway) để xem dữ liệu cảm biến trực tiếp. Chỉ nhận dữ liệu khi app đang mở màn hình.',
                  ),
                ),
                const SizedBox(height: 8),
                RiceCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: SwitchListTile(
                    secondary: const Icon(
                      Icons.sensors,
                      color: AppColors.primary,
                    ),
                    title: const Text('Nhận dữ liệu trạm'),
                    subtitle: const Text('Kết nối gateway LoRa qua MQTT'),
                    value: _enabled,
                    activeThumbColor: AppColors.primary,
                    onChanged: (value) => setState(() => _enabled = value),
                  ),
                ),
                const SizedBox(height: 8),
                RiceCard(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildConnectionStatus(mqtt),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _host,
                        enabled: _enabled,
                        decoration: const InputDecoration(
                          labelText: 'Broker — địa chỉ IP / host',
                          hintText: '192.168.1.10',
                          prefixIcon: Icon(Icons.dns_outlined),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _port,
                              enabled: _enabled,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                              ],
                              decoration: const InputDecoration(
                                labelText: 'Cổng',
                                prefixIcon: Icon(Icons.numbers),
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: SwitchListTile(
                              title: const Text('TLS'),
                              subtitle: const Text('8883'),
                              value: _tls,
                              onChanged: _enabled
                                  ? (value) => setState(() {
                                      _tls = value;
                                      if (_port.text.trim() ==
                                          '$_defaultPort') {
                                        _port.text = '$_defaultTlsPort';
                                      }
                                    })
                                  : null,
                              activeThumbColor: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                      if (_tls) ...[
                        const SizedBox(height: 8),
                        const Text(
                          'Bật TLS khi broker dùng chứng chỉ (MQTT over TLS).',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _username,
                        enabled: _enabled,
                        decoration: const InputDecoration(
                          labelText: 'Tên đăng nhập (tuỳ chọn)',
                          prefixIcon: Icon(Icons.person_outline),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _password,
                        enabled: _enabled,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Mật khẩu (tuỳ chọn)',
                          prefixIcon: Icon(Icons.lock_outline),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _topic,
                        enabled: _enabled,
                        decoration: InputDecoration(
                          labelText: 'Topic nhận dữ liệu',
                          hintText: 'riceguardian/station/+/reading',
                          prefixIcon: const Icon(Icons.topic_outlined),
                          border: const OutlineInputBorder(),
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.restore),
                            tooltip: 'Khôi phục mặc định',
                            onPressed: _enabled
                                ? () => setState(
                                    () => _topic.text =
                                        'riceguardian/station/+/reading',
                                  )
                                : null,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      RicePrimaryButton(
                        label: 'Lưu & Kết nối',
                        icon: Icons.save_outlined,
                        onPressed: _saveMqtt,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionHeader(title: 'Thông báo'),
                RiceCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: SwitchListTile(
                    secondary: const Icon(
                      Icons.notifications_outlined,
                      color: AppColors.primary,
                    ),
                    title: const Text('Bật thông báo'),
                    subtitle: const Text('Nhận cảnh báo bệnh trên máy này'),
                    value: _notifications,
                    activeThumbColor: AppColors.primary,
                    onChanged: _saveNotifications,
                  ),
                ),
                const SizedBox(height: 8),
                const SectionHeader(title: 'Ngôn ngữ'),
                const RiceCard(
                  child: InfoBanner(
                    icon: Icons.translate,
                    message:
                        'Ngôn ngữ hiện chỉ hỗ trợ Tiếng Việt. Tuỳ chọn đa ngôn ngữ sẽ có ở bản sau.',
                  ),
                ),
                const SizedBox(height: 8),
                const SectionHeader(title: 'Về ứng dụng'),
                const RiceCard(
                  child: Column(
                    children: [
                      InfoRow(label: 'Ứng dụng', value: 'RiceGuardian AI'),
                      InfoRow(
                        label: 'Phiên bản',
                        value: '1.0.0+1',
                        showDivider: false,
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildConnectionStatus(MqttDataProvider mqtt) {
    final status = mqtt.status;
    final (color, label) = switch (status) {
      MqttLinkStatus.connected => (
        AppColors.primary,
        'Đã kết nối${_lastMessageSuffix(mqtt.lastMessageAt)}',
      ),
MqttLinkStatus.connecting => (
          AppColors.secondary,
          'Đang kết nối...${_lastMessageSuffix(mqtt.lastMessageAt)}',
        ),
      MqttLinkStatus.disconnected => (AppColors.danger, 'Mất kết nối'),
      MqttLinkStatus.idle => (AppColors.textSecondary, 'Chưa kết nối'),
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                status == MqttLinkStatus.connected
                    ? Icons.check_circle
                    : Icons.info_outline,
                size: 18,
                color: color,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
          if (mqtt.lastTopic != null) ...[
            const SizedBox(height: 4),
            Text(
              mqtt.lastTopic!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
          if (status == MqttLinkStatus.disconnected &&
              mqtt.lastError != null) ...[
            const SizedBox(height: 4),
            Text(
              mqtt.lastError!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, color: AppColors.danger),
            ),
          ],
        ],
      ),
    );
  }
}

String _lastMessageSuffix(DateTime? at) {
  if (at == null) return '';
  final diff = DateTime.now().difference(at);
  final text = diff.inSeconds < 60
      ? '${diff.inSeconds}s'
      : diff.inMinutes < 60
      ? '${diff.inMinutes} phút'
      : '${diff.inHours} giờ';
  return ' · gói gần nhất $text trước';
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../providers/app_providers.dart';
import '../../utils/metric_display.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/rice/rice.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notifications = true;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = context.read<AppDataProvider>();
    await data.loadSettings();
    if (!mounted) return;
    final settings = data.settings;
    setState(() {
      _notifications = settings?['notificationsEnabled'] as bool? ?? true;
      _loading = false;
    });
  }

  Future<void> _saveNotifications(bool value) async {
    setState(() => _notifications = value);
    await context
        .read<AppDataProvider>()
        .saveSettings({'notificationsEnabled': value});
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(value ? 'Đã bật thông báo' : 'Đã tắt thông báo'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cài đặt')),
      body: _loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
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
                        value: metricDash,
                        showDivider: false,
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

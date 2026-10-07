import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../providers/app_providers.dart';
import '../../widgets/rice/rice.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  bool _editing = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _cancelEdit() {
    final user = context.read<AuthProvider>().user;
    _nameController.text = user?.fullName ?? '';
    _phoneController.text = user?.phone ?? '';
    setState(() {
      _editing = false;
      _error = null;
    });
  }

  Future<void> _saveProfile() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final user = await context.read<AuthProvider>().authService.updateProfile(
            fullName: _nameController.text.trim(),
            phone: _phoneController.text.trim(),
          );
      if (mounted) {
        context.read<AuthProvider>().setUser(user);
        setState(() {
          _editing = false;
          _saving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã cập nhật hồ sơ')),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = error.toString();
        });
      }
    }
  }

  Future<void> _changePassword() async {
    final oldController = TextEditingController();
    final newController = TextEditingController();
    final confirmController = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: ListenableBuilder(
          listenable: Listenable.merge(
            [oldController, newController, confirmController],
          ),
          builder: (ctx, _) {
            final mismatch = confirmController.text.isNotEmpty &&
                confirmController.text != newController.text;
            final valid = oldController.text.isNotEmpty &&
                newController.text.isNotEmpty &&
                confirmController.text == newController.text;
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Đổi mật khẩu',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 16),
                RiceTextField(
                  controller: oldController,
                  label: 'Mật khẩu cũ',
                  prefixIcon: Icons.lock_outline,
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                RiceTextField(
                  controller: newController,
                  label: 'Mật khẩu mới',
                  prefixIcon: Icons.lock_outline,
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                RiceTextField(
                  controller: confirmController,
                  label: 'Xác nhận',
                  prefixIcon: Icons.lock_outline,
                  obscureText: true,
                ),
                if (mismatch) ...[
                  const SizedBox(height: 8),
                  const RiceErrorBanner(
                    message: 'Mật khẩu xác nhận không khớp',
                  ),
                ],
                const SizedBox(height: 16),
                RicePrimaryButton(
                  label: 'Lưu',
                  onPressed: valid ? () => Navigator.pop(ctx, true) : null,
                ),
              ],
            );
          },
        ),
      ),
    );
    if (ok == true && mounted) {
      try {
        await context.read<AuthProvider>().authService.changePassword(
              oldController.text,
              newController.text,
            );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Đã đổi mật khẩu')),
          );
        }
      } catch (error) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(error.toString()),
              backgroundColor: AppColors.danger,
            ),
          );
        }
      }
    }
    oldController.dispose();
    newController.dispose();
    confirmController.dispose();
  }

  Future<void> _logout() async {
    final confirmed = await showConfirmDialog(
      context,
      icon: Icons.logout,
      title: 'Đăng xuất?',
      message:
          'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng ứng dụng. Dữ liệu đã lưu trên máy vẫn được giữ.',
      confirmLabel: 'Đăng xuất',
    );
    if (!confirmed || !mounted) return;
    await context.read<AuthProvider>().logout();
    if (mounted) context.go('/login');
  }

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return 'ND';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final showEmail = auth.usesRemoteAuth && (user?.email.isNotEmpty ?? false);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cá nhân'),
        actions: [
          if (!_editing)
            TextButton(
              onPressed: () => setState(() => _editing = true),
              style: TextButton.styleFrom(foregroundColor: Colors.white),
              child: const Text('Sửa'),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          RiceCard(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  child: Text(
                    _initials(user?.fullName),
                    style: const TextStyle(
                      fontSize: 28,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  user?.fullName ?? '',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Nông dân',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          RiceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Thông tin',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  RiceErrorBanner(message: _error!),
                ],
                const SizedBox(height: 4),
                if (_editing) ...[
                  const SizedBox(height: 8),
                  RiceTextField(
                    controller: _nameController,
                    label: 'Họ tên',
                    prefixIcon: Icons.person_outline,
                  ),
                  const SizedBox(height: 12),
                  RiceTextField(
                    controller: _phoneController,
                    label: 'Số điện thoại',
                    prefixIcon: Icons.phone_android,
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: _saving ? null : _cancelEdit,
                          child: const Text('Hủy'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: RicePrimaryButton(
                          label: 'Lưu',
                          loading: _saving,
                          onPressed: _saveProfile,
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  InfoRow(
                    icon: Icons.person_outline,
                    label: 'Họ tên',
                    value: user?.fullName ?? '',
                  ),
                  InfoRow(
                    icon: Icons.phone_android,
                    label: 'Số điện thoại',
                    value: user?.phone ?? '',
                    showDivider: showEmail,
                  ),
                  if (showEmail)
                    InfoRow(
                      icon: Icons.email_outlined,
                      label: 'Email',
                      value: user!.email,
                      showDivider: false,
                    ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          RiceCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                _MenuRow(
                  icon: Icons.forum_outlined,
                  label: 'Câu hỏi bản tin của tôi',
                  onTap: () => context.push('/my-questions'),
                ),
                const Divider(indent: 56),
                _MenuRow(
                  icon: Icons.lock_outline,
                  label: 'Đổi mật khẩu',
                  onTap: _changePassword,
                ),
                const Divider(indent: 56),
                _MenuRow(
                  icon: Icons.settings_outlined,
                  label: 'Cài đặt App',
                  onTap: () => context.push('/settings'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          DestructiveOutlineButton(
            label: 'Đăng xuất',
            icon: Icons.logout,
            onPressed: _logout,
          ),
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      minTileHeight: 56,
      leading: Icon(icon, color: AppColors.primary),
      title: Text(
        label,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      ),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
    );
  }
}

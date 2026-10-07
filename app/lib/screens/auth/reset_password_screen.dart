import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../providers/app_providers.dart';
import '../../widgets/auth/auth_chrome.dart';
import '../../widgets/rice/rice.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.initialToken});

  final String? initialToken;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _tokenController;
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _tokenController = TextEditingController(text: widget.initialToken ?? '');
  }

  @override
  void dispose() {
    _tokenController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final ok = await auth.resetPassword(
      token: _tokenController.text.trim(),
      password: _passwordController.text,
    );
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đặt lại mật khẩu thành công. Hãy đăng nhập.')),
      );
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: AuthPhotoBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AuthHeader(
                    title: 'Đặt lại mật khẩu',
                    onBack: () => context.pop(),
                  ),
                  AuthFrostedCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (auth.error != null) ...[
                          RiceErrorBanner(message: auth.error!),
                          const SizedBox(height: 12),
                        ],
                        RiceTextField(
                          controller: _tokenController,
                          label: 'Mã đặt lại',
                          prefixIcon: Icons.vpn_key_outlined,
                          enabled: !auth.isLoading,
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Nhập mã đặt lại'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        RiceTextField(
                          controller: _passwordController,
                          label: 'Mật khẩu mới',
                          prefixIcon: Icons.lock_outline,
                          obscureText: _obscure,
                          enabled: !auth.isLoading,
                          suffix: IconButton(
                            icon: Icon(
                              _obscure ? Icons.visibility_off : Icons.visibility,
                              color: AppColors.primary,
                            ),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                          validator: (v) {
                            if (v == null || v.isEmpty) return 'Nhập mật khẩu mới';
                            if (v.length < 6) return 'Ít nhất 6 ký tự';
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        RiceTextField(
                          controller: _confirmController,
                          label: 'Xác nhận mật khẩu',
                          prefixIcon: Icons.lock_outline,
                          obscureText: _obscure,
                          enabled: !auth.isLoading,
                          validator: (v) {
                            if (v != _passwordController.text) {
                              return 'Mật khẩu xác nhận không khớp';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 18),
                        ListenableBuilder(
                          listenable: Listenable.merge([
                            _tokenController,
                            _passwordController,
                            _confirmController,
                          ]),
                          builder: (context, _) {
                            final filled = [
                              _tokenController,
                              _passwordController,
                              _confirmController,
                            ].every((c) => c.text.trim().isNotEmpty);
                            return RicePrimaryButton(
                              label: 'Đặt lại mật khẩu',
                              loading: auth.isLoading,
                              onPressed: filled ? _submit : null,
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

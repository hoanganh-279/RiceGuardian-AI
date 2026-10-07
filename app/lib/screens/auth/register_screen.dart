import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../providers/app_providers.dart';
import '../../widgets/auth/auth_chrome.dart';
import '../../widgets/rice/rice.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final ok = await auth.register(
      fullName: _nameController.text.trim(),
      email: _emailController.text.trim(),
      phone: _phoneController.text.trim(),
      password: _passwordController.text,
    );
    if (!mounted) return;
    if (ok) {
      unawaited(context.read<AppDataProvider>().refreshDashboard());
      context.go('/home');
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
                    title: 'Đăng ký',
                    subtitle: 'Tạo tài khoản nông dân để sử dụng ứng dụng',
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
                          controller: _nameController,
                          label: 'Họ và tên',
                          prefixIcon: Icons.person_outline,
                          enabled: !auth.isLoading,
                          validator: (v) =>
                              (v == null || v.trim().isEmpty) ? 'Nhập họ tên' : null,
                        ),
                        const SizedBox(height: 12),
                        RiceTextField(
                          controller: _phoneController,
                          label: 'Số điện thoại',
                          prefixIcon: Icons.phone_android,
                          keyboardType: TextInputType.phone,
                          enabled: !auth.isLoading,
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Nhập số điện thoại'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        RiceTextField(
                          controller: _emailController,
                          label: 'Email',
                          prefixIcon: Icons.email_outlined,
                          keyboardType: TextInputType.emailAddress,
                          enabled: !auth.isLoading,
                          validator: (v) {
                            final value = v?.trim() ?? '';
                            if (value.isEmpty) return 'Nhập email';
                            if (!value.contains('@')) return 'Email không hợp lệ';
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        RiceTextField(
                          controller: _passwordController,
                          label: 'Mật khẩu',
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
                            if (v == null || v.isEmpty) return 'Nhập mật khẩu';
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
                            _nameController,
                            _phoneController,
                            _emailController,
                            _passwordController,
                            _confirmController,
                          ]),
                          builder: (context, _) {
                            final filled = [
                              _nameController,
                              _phoneController,
                              _emailController,
                              _passwordController,
                              _confirmController,
                            ].every((c) => c.text.trim().isNotEmpty);
                            return RicePrimaryButton(
                              label: 'Đăng ký',
                              loading: auth.isLoading,
                              onPressed: filled ? _submit : null,
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: auth.isLoading ? null : () => context.go('/login'),
                    style: TextButton.styleFrom(foregroundColor: Colors.white),
                    child: const Text('Đã có tài khoản? Đăng nhập'),
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

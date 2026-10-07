import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../providers/app_providers.dart';
import '../../widgets/app_logo.dart';
import '../../widgets/auth/auth_chrome.dart';
import '../../widgets/rice/rice.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _afterAuthSuccess() async {
    if (!mounted) return;
    unawaited(context.read<AppDataProvider>().refreshDashboard());
    context.go('/home');
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final ok = await auth.login(
      _phoneController.text.trim(),
      _passwordController.text,
    );
    if (ok) await _afterAuthSuccess();
  }

  Future<void> _google() async {
    final auth = context.read<AuthProvider>();
    final ok = await auth.loginWithGoogle();
    if (ok) await _afterAuthSuccess();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: AuthPhotoBackground(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight - 32,
                  ),
                  child: IntrinsicHeight(
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Spacer(flex: 1),
                          Center(
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.25),
                                    blurRadius: 16,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: const AppLogo(size: 64),
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'RiceGuardian AI',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Chăm ruộng thông minh',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 15,
                              color: Colors.white.withValues(alpha: 0.85),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 22),
                          AuthFrostedCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const Text(
                                  'Đăng nhập',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Đăng nhập để tiếp tục sử dụng ứng dụng',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                if (auth.error != null) ...[
                                  const SizedBox(height: 14),
                                  RiceErrorBanner(message: auth.error!),
                                ],
                                const SizedBox(height: 16),
                                RiceTextField(
                                  controller: _phoneController,
                                  label: 'Số điện thoại',
                                  prefixIcon: Icons.phone_android,
                                  keyboardType: TextInputType.phone,
                                  enabled: !auth.isLoading,
                                  validator: (v) =>
                                      (v == null || v.trim().isEmpty)
                                          ? 'Nhập số điện thoại'
                                          : null,
                                ),
                                const SizedBox(height: 14),
                                RiceTextField(
                                  controller: _passwordController,
                                  label: 'Mật khẩu',
                                  prefixIcon: Icons.lock_outline,
                                  obscureText: _obscurePassword,
                                  enabled: !auth.isLoading,
                                  suffix: IconButton(
                                    icon: Icon(
                                      _obscurePassword
                                          ? Icons.visibility_off
                                          : Icons.visibility,
                                      color: AppColors.primary,
                                    ),
                                    onPressed: () {
                                      setState(() {
                                        _obscurePassword = !_obscurePassword;
                                      });
                                    },
                                    tooltip: _obscurePassword
                                        ? 'Hiện mật khẩu'
                                        : 'Ẩn mật khẩu',
                                  ),
                                  validator: (v) => (v == null || v.isEmpty)
                                      ? 'Nhập mật khẩu'
                                      : null,
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    SizedBox(
                                      height: 24,
                                      width: 24,
                                      child: Checkbox(
                                        value: auth.rememberMe,
                                        activeColor: AppColors.primary,
                                        onChanged: auth.isLoading
                                            ? null
                                            : (v) => auth
                                                .setRememberMe(v ?? true),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: GestureDetector(
                                        onTap: auth.isLoading
                                            ? null
                                            : () => auth.setRememberMe(
                                                  !auth.rememberMe,
                                                ),
                                        child: const Text(
                                          'Ghi nhớ đăng nhập',
                                          style: TextStyle(fontSize: 13),
                                        ),
                                      ),
                                    ),
                                    TextButton(
                                      onPressed: auth.isLoading
                                          ? null
                                          : () {
                                              auth.clearError();
                                              context.push('/forgot-password');
                                            },
                                      child: const Text(
                                        'Quên mật khẩu?',
                                        style: TextStyle(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                ListenableBuilder(
                                  listenable: Listenable.merge([
                                    _phoneController,
                                    _passwordController,
                                  ]),
                                  builder: (context, _) => RicePrimaryButton(
                                    label: 'Đăng nhập',
                                    loading: auth.isLoading,
                                    onPressed: _phoneController.text
                                                .trim()
                                                .isEmpty ||
                                            _passwordController.text.isEmpty
                                        ? null
                                        : _submit,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Expanded(
                                child: Divider(
                                  color: Colors.white.withValues(alpha: 0.5),
                                ),
                              ),
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 12),
                                child: Text(
                                  'Hoặc đăng nhập với',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.white.withValues(alpha: 0.9),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Divider(
                                  color: Colors.white.withValues(alpha: 0.5),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Center(
                            child: GoogleSignInCircleButton(
                              enabled: !auth.isLoading,
                              onPressed: _google,
                            ),
                          ),
                          const SizedBox(height: 18),
                          if (!auth.usesRemoteAuth)
                            const InfoBanner(
                              icon: Icons.info_outline,
                              message: 'Tài khoản demo: 0901234567 / Demo@123',
                            ),
                          const SizedBox(height: 8),
                          Wrap(
                            alignment: WrapAlignment.center,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              const Text(
                                'Chưa có tài khoản? ',
                                style: TextStyle(color: Colors.white),
                              ),
                              TextButton(
                                onPressed: auth.isLoading
                                    ? null
                                    : () {
                                        auth.clearError();
                                        context.push('/register');
                                      },
                                child: const Text(
                                  'Đăng ký ngay',
                                  style: TextStyle(
                                    color: AppColors.secondary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const Spacer(flex: 2),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../providers/app_providers.dart';
import '../../widgets/auth/auth_chrome.dart';
import '../../widgets/rice/rice.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  String? _successMessage;
  String? _debugToken;

  @override
  void dispose() {
    _identifierController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final payload = await auth.requestPasswordReset(
      _identifierController.text.trim(),
    );
    if (!mounted || payload == null) return;
    setState(() {
      _successMessage = payload['message']?.toString() ??
          'Nếu tài khoản tồn tại, mã đặt lại đã được tạo.';
      _debugToken = payload['resetToken']?.toString();
    });
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
                    title: 'Quên mật khẩu',
                    subtitle: 'Nhập email hoặc số điện thoại đã đăng ký',
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
                        if (_successMessage != null) ...[
                          InfoBanner(message: _successMessage!),
                          if (_debugToken != null) ...[
                            const SizedBox(height: 8),
                            SelectableText(
                              'Mã (dev): $_debugToken',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ],
                          const SizedBox(height: 12),
                        ],
                        RiceTextField(
                          controller: _identifierController,
                          label: 'Email hoặc số điện thoại',
                          prefixIcon: Icons.mail_outline,
                          enabled: !auth.isLoading,
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Nhập email hoặc số điện thoại'
                              : null,
                        ),
                        const SizedBox(height: 18),
                        ListenableBuilder(
                          listenable: _identifierController,
                          builder: (context, _) => RicePrimaryButton(
                            label: 'Gửi yêu cầu',
                            loading: auth.isLoading,
                            onPressed:
                                _identifierController.text.trim().isEmpty
                                    ? null
                                    : _submit,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () {
                            context.push(
                              '/reset-password',
                              extra: _debugToken,
                            );
                          },
                          child: const Text('Tôi đã có mã đặt lại'),
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

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/app_colors.dart';
import '../../providers/app_providers.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/rice/rice.dart';

class FieldLogSheet extends StatefulWidget {
  const FieldLogSheet({super.key, required this.fieldId});

  final String fieldId;

  @override
  State<FieldLogSheet> createState() => _FieldLogSheetState();
}

class _FieldLogSheetState extends State<FieldLogSheet> {
  String _type = 'bon_phan';
  final _noteController = TextEditingController();
  bool _submitting = false;
  String? _error;

  static const _types = [
    ChoiceOption(value: 'bon_phan', label: 'Bón phân', icon: Icons.compost),
    ChoiceOption(
      value: 'phun_thuoc',
      label: 'Phun thuốc',
      icon: Icons.sanitizer_outlined,
    ),
    ChoiceOption(
      value: 'tuoi_nuoc',
      label: 'Tưới nước',
      icon: Icons.water_drop_outlined,
    ),
  ];

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<AppDataProvider>().createFieldLog(
            fieldId: widget.fieldId,
            type: _type,
            note: _noteController.text.trim(),
          );
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã ghi nhật ký canh tác')),
        );
      }
    } catch (error) {
      setState(() {
        _error = errorMessage(error);
        _submitting = false;
      });
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Ghi nhật ký canh tác',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          const Text(
            'Loại hoạt động',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          ChoiceChipGroup<String>(
            options: _types,
            selected: _type,
            onSelected: (v) => setState(() => _type = v),
          ),
          const SizedBox(height: 16),
          RiceTextField(
            controller: _noteController,
            label: 'Ghi chú (tùy chọn)',
            prefixIcon: Icons.notes,
            maxLines: 3,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            RiceErrorBanner(message: _error!),
          ],
          const SizedBox(height: 16),
          RicePrimaryButton(
            label: 'Lưu',
            loading: _submitting,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

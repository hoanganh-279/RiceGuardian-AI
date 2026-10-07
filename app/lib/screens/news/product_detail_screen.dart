import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../widgets/rice/rice.dart';

/// Static product detail for Trạm giám sát IoT (not CMS).
class ProductDetailScreen extends StatelessWidget {
  const ProductDetailScreen({super.key});

  static const _features = [
    'Năng lượng mặt trời',
    'Cảm biến vi khí hậu',
    'Phục vụ cảnh báo sớm',
    'Lắp đặt tại thửa',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sản phẩm')),
      body: ListView(
        children: [
          Image.asset(
            'img/monitoring_station.png',
            height: 280,
            width: double.infinity,
            fit: BoxFit.contain,
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Trạm giám sát RiceGuardian AI',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Trạm IoT cấp nguồn mặt trời, đo vi khí hậu (nhiệt độ, độ ẩm, gió…) '
                  'để hỗ trợ dự báo nguy cơ bệnh lúa và cảnh báo sớm trên App nông dân. '
                  'Mỗi thửa có thể gắn một trạm theo mô hình canh tác của hệ thống.',
                  style: TextStyle(height: 1.5, fontSize: 15),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final f in _features)
                      TipChip(icon: Icons.check_circle_outline, label: f),
                  ],
                ),
                const SizedBox(height: 24),
                RiceOutlinedButton(
                  label: 'Xem thửa của tôi',
                  icon: Icons.map_outlined,
                  onPressed: () => context.go('/fields'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

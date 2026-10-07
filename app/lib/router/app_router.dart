import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/field_model.dart';
import '../providers/app_providers.dart';
import '../screens/alerts/alerts_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/auth/reset_password_screen.dart';
import '../screens/auth/splash_screen.dart';
import '../screens/camera/camera_screen.dart';
import '../screens/fields/field_detail_screen.dart';
import '../screens/fields/fields_list_screen.dart';
import '../screens/home/dashboard_screen.dart';
import '../screens/home/shell_screen.dart';
import '../screens/news/article_detail_screen.dart';
import '../screens/news/my_questions_screen.dart';
import '../screens/news/news_list_screen.dart';
import '../screens/news/product_detail_screen.dart';
import '../screens/news/question_thread_screen.dart';
import '../screens/notifications/notifications_screen.dart';
import '../screens/photos/photo_history_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../services/ai_service.dart';

class AppRouter {
  AppRouter(this.authProvider);

  final AuthProvider authProvider;

  late final GoRouter router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: authProvider,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      if (loc == '/splash') return null;

      const publicAuthRoutes = {
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
      };
      final onPublicAuth = publicAuthRoutes.contains(loc);
      if (authProvider.isLoading) return null;
      if (!authProvider.isAuthenticated) {
        return onPublicAuth ? null : '/login';
      }
      if (onPublicAuth) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (_, __) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (_, __) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/reset-password',
        builder: (context, state) {
          final token = state.extra is String ? state.extra as String : null;
          return ResetPasswordScreen(initialToken: token);
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ShellScreen(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (_, __) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/fields',
                builder: (_, __) => const FieldsListScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/camera',
                builder: (_, __) => const CameraScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/alerts',
                builder: (_, __) => const AlertsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (_, __) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/fields/:id',
        builder: (context, state) {
          final field = state.extra as FieldModel?;
          if (field == null) {
            return const Scaffold(
              body: Center(child: Text('Không tìm thấy thửa ruộng')),
            );
          }
          return FieldDetailScreen(field: field);
        },
      ),
      GoRoute(
        path: '/camera/preview',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>;
          final rawBoxes = extra['boxes'];
          final boxes = <AiBox>[];
          if (rawBoxes is List) {
            for (final item in rawBoxes) {
              if (item is Map<String, dynamic>) {
                final box = AiBox.fromJson(item);
                if (box != null) boxes.add(box);
              } else if (item is Map) {
                final box = AiBox.fromJson(Map<String, dynamic>.from(item));
                if (box != null) boxes.add(box);
              }
            }
          }
          final rawScores = extra['scores'];
          final scores = <DiseaseScore>[];
          if (rawScores is List) {
            for (final item in rawScores) {
              if (item is Map<String, dynamic>) {
                final score = DiseaseScore.fromJson(item);
                if (score != null) scores.add(score);
              } else if (item is Map) {
                final score =
                    DiseaseScore.fromJson(Map<String, dynamic>.from(item));
                if (score != null) scores.add(score);
              }
            }
          }
          return PhotoPreviewScreen(
            imagePath: extra['path'] as String,
            savePath: extra['savePath'] as String?,
            field: extra['field'] as FieldModel,
            disease: extra['disease'] as String,
            confidence: extra['confidence'] as double,
            stage: extra['stage'] as String? ?? 'unknown',
            boxes: boxes,
            scores: scores,
            secondaryDisease: extra['secondaryDisease'] as String?,
            secondaryConfidence:
                (extra['secondaryConfidence'] as num?)?.toDouble(),
            lat: extra['lat'] as double?,
            lng: extra['lng'] as double?,
          );
        },
      ),
      GoRoute(path: '/photos', builder: (_, __) => const PhotoHistoryScreen()),
      GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsScreen(),
      ),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
      GoRoute(path: '/news', builder: (_, __) => const NewsListScreen()),
      GoRoute(
        path: '/news/:id',
        builder: (context, state) => ArticleDetailScreen(
          articleId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(path: '/product', builder: (_, __) => const ProductDetailScreen()),
      GoRoute(path: '/my-questions', builder: (_, __) => const MyQuestionsScreen()),
      GoRoute(
        path: '/my-questions/:id',
        builder: (context, state) => QuestionThreadScreen(
          questionId: state.pathParameters['id']!,
        ),
      ),
    ],
  );
}

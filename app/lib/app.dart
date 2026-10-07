import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config/app_theme.dart';
import 'providers/app_providers.dart';
import 'router/app_router.dart';
import 'services/auth_service.dart';
import 'services/disease_catalog_service.dart';

class RiceGuardianApp extends StatefulWidget {
  const RiceGuardianApp({super.key});

  @override
  State<RiceGuardianApp> createState() => _RiceGuardianAppState();
}

class _RiceGuardianAppState extends State<RiceGuardianApp> {
  late final AuthService _authService;
  late final AuthProvider _authProvider;
  late final AppDataProvider _dataProvider;
  late final AppRouter _appRouter;

  @override
  void initState() {
    super.initState();
    _authService = AuthService();
    _authProvider = AuthProvider(_authService);
    _dataProvider = AppDataProvider(_authProvider);
    _appRouter = AppRouter(_authProvider);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    unawaited(DiseaseCatalogService.instance.load());
    await _authProvider.bootstrap();
    if (_authProvider.isAuthenticated) {
      unawaited(_dataProvider.refreshDashboard());
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _authProvider),
        ChangeNotifierProvider.value(value: _dataProvider),
      ],
      child: MaterialApp.router(
        title: 'RiceGuardian AI',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        routerConfig: _appRouter.router,
      ),
    );
  }
}

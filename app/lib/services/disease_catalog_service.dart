import 'dart:convert';

import 'package:flutter/services.dart';

/// Offline disease catalog (mirrors packages/rg_core/core/data/disease_catalog.py).
class DiseaseCatalogEntry {
  const DiseaseCatalogEntry({
    required this.code,
    required this.nameVi,
    required this.summary,
    required this.actions,
  });

  final String code;
  final String nameVi;
  final String summary;
  final List<String> actions;

  bool get isHealthy => code == 'Rice__Healthy' || nameVi == 'Khỏe mạnh';

  factory DiseaseCatalogEntry.fromJson(Map<String, dynamic> json) {
    return DiseaseCatalogEntry(
      code: json['code'] as String? ?? '',
      nameVi: json['nameVi'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      actions: (json['actions'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
    );
  }
}

class DiseaseCatalogService {
  DiseaseCatalogService._();

  static final DiseaseCatalogService instance = DiseaseCatalogService._();

  List<DiseaseCatalogEntry> _entries = const [];
  Map<String, DiseaseCatalogEntry> _byCode = {};
  Map<String, DiseaseCatalogEntry> _byName = {};
  bool _loaded = false;

  bool get isLoaded => _loaded;
  List<DiseaseCatalogEntry> get entries => _entries;

  Future<void> load() async {
    if (_loaded) return;
    final raw = await rootBundle.loadString('assets/disease_catalog.json');
    final list = jsonDecode(raw) as List<dynamic>;
    _entries = list
        .map((e) => DiseaseCatalogEntry.fromJson(e as Map<String, dynamic>))
        .toList();
    _byCode = {for (final e in _entries) e.code: e};
    _byName = {
      for (final e in _entries) e.nameVi.toLowerCase().trim(): e,
    };
    _loaded = true;
  }

  DiseaseCatalogEntry? lookupByCode(String? code) {
    if (code == null || code.isEmpty) return null;
    return _byCode[code.trim()];
  }

  DiseaseCatalogEntry? lookupByNameVi(String? name) {
    if (name == null || name.trim().isEmpty) return null;
    final key = name.toLowerCase().trim();
    final direct = _byName[key];
    if (direct != null) return direct;
    // Tolerate AI labels that include extra confidence text.
    for (final entry in _entries) {
      if (key.contains(entry.nameVi.toLowerCase())) return entry;
    }
    return null;
  }

  DiseaseCatalogEntry? lookup(String? codeOrName) {
    return lookupByCode(codeOrName) ?? lookupByNameVi(codeOrName);
  }
}

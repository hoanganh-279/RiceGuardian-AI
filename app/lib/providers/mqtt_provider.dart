import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/field_model.dart';
import '../models/mqtt_config.dart';
import '../models/sensor_reading_model.dart';
import '../services/local_store.dart';
import '../services/mqtt_service.dart';

class MqttDataProvider extends ChangeNotifier {
  MqttDataProvider({required LocalStore store, MqttService? service})
    : _store = store,
      _service = service ?? MqttService() {
    _readingsSub = _service.readings.listen(_onReading);
  }

  final LocalStore _store;
  final MqttService _service;
  late final StreamSubscription<SensorReading> _readingsSub;

  MqttConfig _config = const MqttConfig();
  final Map<int, SensorReading> _latestByNode = {};
  final List<SensorReading> _history = [];

  static const _maxHistory = 200;

  @visibleForTesting
  bool autoConnect = true;

  MqttConfig get config => _config;
  MqttLinkStatus get status => _service.status;
  DateTime? get lastMessageAt => _service.lastMessageAt;
  String? get lastTopic => _service.lastTopic;
  String? get lastError => _service.lastError;
  Map<int, SensorReading> get latestByNode => Map.unmodifiable(_latestByNode);
  List<SensorReading> get history => List.unmodifiable(_history);
  bool get enabled => _config.enabled && _config.isConfigured;

  Future<void> bootstrap() async {
    _config = await _store.getMqttConfig();
    if (enabled) {
      unawaited(_connect());
    }
    notifyListeners();
  }

  Future<void> applyConfig(MqttConfig config) async {
    _config = config;
    await _store.saveMqttConfig(config);
    if (enabled) {
      unawaited(_connect());
    } else {
      unawaited(_service.disconnect());
    }
    notifyListeners();
  }

  Future<void> reconnect() async {
    if (!enabled) return;
    unawaited(_connect());
  }

  Future<void> _connect() async {
    if (!autoConnect) return;
    await _service.connect(_config);
    notifyListeners();
  }

  void _onReading(SensorReading reading) {
    final previous = _latestByNode[reading.nodeId];
    if (previous != null &&
        reading.seq <= previous.seq &&
        !reading.recordedAt.isAfter(previous.recordedAt)) {
      return;
    }
    _latestByNode[reading.nodeId] = reading;
    _history.insert(0, reading);
    if (_history.length > _maxHistory) {
      _history.removeRange(_maxHistory, _history.length);
    }
    notifyListeners();
  }

  SensorReading? readingForNode(int nodeId) => _latestByNode[nodeId];

  SensorReading? readingForField(String fieldId, List<FieldModel> fields) {
    final mappedNode = _config.fieldNodeMap[fieldId];
    if (mappedNode != null) return _latestByNode[mappedNode];

    final index = fields.indexWhere((f) => f.id == fieldId);
    if (index < 0) return null;
    final nodes = (_latestByNode.keys.toList()..sort());
    if (nodes.isEmpty) return null;
    return _latestByNode[nodes[index % nodes.length]];
  }

  @override
  void dispose() {
    _readingsSub.cancel();
    _service.dispose();
    super.dispose();
  }
}

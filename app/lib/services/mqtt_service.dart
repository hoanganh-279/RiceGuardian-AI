import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

import '../models/mqtt_config.dart';
import '../models/sensor_reading_model.dart';
import 'mqtt_payload_parser.dart';

enum MqttLinkStatus { idle, connecting, connected, disconnected }

class MqttService {
  MqttService();

  final StreamController<SensorReading> _readings =
      StreamController.broadcast();
  MqttClient? _client;
  MqttLinkStatus _status = MqttLinkStatus.idle;
  DateTime? _lastMessageAt;
  String? _lastTopic;
  String? _lastError;

  Stream<SensorReading> get readings => _readings.stream;
  MqttLinkStatus get status => _status;
  DateTime? get lastMessageAt => _lastMessageAt;
  String? get lastTopic => _lastTopic;
  String? get lastError => _lastError;
  bool get isActive => _status == MqttLinkStatus.connected;

  Future<void> connect(MqttConfig config) async {
    await disconnect();
    _lastError = null;
    if (!config.isConfigured) {
      debugPrint('[MQTT] not configured, idle');
      _setStatus(MqttLinkStatus.idle);
      return;
    }

    debugPrint('[MQTT] connecting to ${config.host}:${config.port} '
        'client=${config.clientId} tls=${config.tls}');
    final client = MqttServerClient.withPort(
      config.host,
      config.clientId,
      config.port,
      maxConnectionAttempts: 3,
    );
    client.secure = config.tls;
    client.keepAlivePeriod = 20;
    client.connectTimeoutPeriod = 10000;
    client.autoReconnect = true;
    client.resubscribeOnAutoReconnect = true;
    client.onAutoReconnect = () => _setStatus(MqttLinkStatus.connecting);
    client.onAutoReconnected = () {
      debugPrint('[MQTT] auto-reconnected, re-listen updates');
      client.updates?.listen(_onUpdates);
      _setStatus(MqttLinkStatus.connected);
    };
    client.onDisconnected = () {
      debugPrint('[MQTT] disconnected event');
      _setStatus(MqttLinkStatus.disconnected);
    };

    _client = client;
    _setStatus(MqttLinkStatus.connecting);
    try {
      await client.connect(config.username, config.password);
    } catch (error) {
      _client = null;
      _lastError = error.toString();
      debugPrint('[MQTT] connect FAILED: $error');
      _setStatus(MqttLinkStatus.disconnected);
      return;
    }

    if (client.connectionStatus?.state == MqttConnectionState.connected) {
      if (config.topic.isNotEmpty) {
        client.subscribe(config.topic, MqttQos.atMostOnce);
        debugPrint('[MQTT] subscribed to ${config.topic}');
      }
      debugPrint('[MQTT] state=${client.connectionStatus?.state} '
          'CONNECTED to ${config.host}:${config.port}');
      client.updates?.listen(_onUpdates);
      _setStatus(MqttLinkStatus.connected);
    } else {
      _lastError = 'Không thể kết nối MQTT broker.';
      debugPrint('[MQTT] not connected: '
          '${client.connectionStatus?.state}');
      _setStatus(MqttLinkStatus.disconnected);
    }
  }

  void _onUpdates(
      List<MqttReceivedMessage<MqttMessage>> events) {
    for (final event in events) {
      final payload = event.payload;
      debugPrint('[MQTT] event ${event.topic} '
          'payloadType=${payload.runtimeType}');
      _dispatchMessage(event);
    }
  }

  void _dispatchMessage(MqttReceivedMessage<MqttMessage> event) {
    final payload = event.payload;
    if (payload is! MqttPublishMessage) return;
    final text = MqttPublishPayload.bytesToStringAsString(
      payload.payload.message,
    );
    final reading = parseMqttPayload(event.topic, text);
    if (reading == null) {
      debugPrint('[MQTT] parse FAILED for <${event.topic}>: $text');
      return;
    }
    _lastMessageAt = DateTime.now();
    _lastTopic = event.topic;
    debugPrint('[MQTT] <${event.topic}> node=${reading.nodeId} '
        'temp=${reading.tempC}C humi=${reading.humidityPct}% '
        'soil=${reading.soilMoisturePct}% light=${reading.lightLux}% '
        'rssi=${reading.rssi} hop=${reading.hop} seq=${reading.seq}');
    _readings.add(reading);
  }

  Future<void> disconnect() async {
    final client = _client;
    _client = null;
    if (client != null) {
      client.disconnect();
    }
    _setStatus(MqttLinkStatus.idle);
  }

  @visibleForTesting
  void emitReading(SensorReading reading) {
    _lastMessageAt = DateTime.now();
    _lastTopic = reading.topic;
    _readings.add(reading);
  }

  void _setStatus(MqttLinkStatus status) {
    if (status != _status) {
      debugPrint('[MQTT] status: $status');
    }
    _status = status;
  }

  void dispose() {
    unawaited(disconnect());
    _readings.close();
  }
}

class MqttConfig {
  const MqttConfig({
    this.host = '',
    this.port = 1883,
    this.tls = false,
    this.username = '',
    this.password = '',
    this.topic = 'riceguardian/station/+/reading',
    this.clientId = '',
    this.enabled = false,
    this.fieldNodeMap = const {},
  });

  final String host;
  final int port;
  final bool tls;
  final String username;
  final String password;
  final String topic;
  final String clientId;
  final bool enabled;
  final Map<String, int> fieldNodeMap;

  bool get isConfigured => host.trim().isNotEmpty;

  MqttConfig copyWith({
    String? host,
    int? port,
    bool? tls,
    String? username,
    String? password,
    String? topic,
    String? clientId,
    bool? enabled,
    Map<String, int>? fieldNodeMap,
  }) {
    return MqttConfig(
      host: host ?? this.host,
      port: port ?? this.port,
      tls: tls ?? this.tls,
      username: username ?? this.username,
      password: password ?? this.password,
      topic: topic ?? this.topic,
      clientId: clientId ?? this.clientId,
      enabled: enabled ?? this.enabled,
      fieldNodeMap: fieldNodeMap ?? this.fieldNodeMap,
    );
  }

  factory MqttConfig.fromJson(Map<String, dynamic> json) {
    return MqttConfig(
      host: json['host'] as String? ?? '',
      port: json['port'] as int? ?? 1883,
      tls: json['tls'] as bool? ?? false,
      username: json['username'] as String? ?? '',
      password: json['password'] as String? ?? '',
      topic: json['topic'] as String? ?? 'riceguardian/station/+/reading',
      clientId: json['clientId'] as String? ?? '',
      enabled: json['enabled'] as bool? ?? false,
      fieldNodeMap:
          (json['fieldNodeMap'] as Map?)?.map(
            (k, v) => MapEntry(k.toString(), (v as num).toInt()),
          ) ??
          const {},
    );
  }

  Map<String, dynamic> toJson() => {
    'host': host,
    'port': port,
    'tls': tls,
    'username': username,
    'password': password,
    'topic': topic,
    'clientId': clientId,
    'enabled': enabled,
    'fieldNodeMap': fieldNodeMap,
  };
}

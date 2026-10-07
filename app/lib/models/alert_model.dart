class AlertModel {
  AlertModel({
    required this.id,
    required this.fieldName,
    required this.type,
    required this.riskLevel,
    required this.title,
    required this.summary,
    required this.createdAt,
    this.confidence,
  });

  final String id;
  final String fieldName;
  final String type;
  final String riskLevel;
  final String title;
  final String summary;
  final String createdAt;
  final double? confidence;

  bool get isEnvironment => type == 'environment';
  bool get isImageDetection => type == 'image';

  factory AlertModel.fromJson(Map<String, dynamic> json) {
    return AlertModel(
      id: json['id'] as String,
      fieldName: json['fieldName'] as String? ?? '',
      type: json['type'] as String? ?? '',
      riskLevel: json['riskLevel'] as String? ?? 'medium',
      title: json['title'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      confidence: (json['confidence'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'fieldName': fieldName,
        'type': type,
        'riskLevel': riskLevel,
        'title': title,
        'summary': summary,
        'createdAt': createdAt,
        'confidence': confidence,
      };
}

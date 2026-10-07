class NotificationModel {
  NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
    required this.type,
    this.relatedAlertId,
    this.relatedArticleId,
    this.relatedQuestionId,
  });

  final String id;
  final String title;
  final String body;
  final bool read;
  final String createdAt;
  final String type;
  final String? relatedAlertId;
  final String? relatedArticleId;
  final String? relatedQuestionId;

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      read: json['read'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
      type: json['type'] as String? ?? 'info',
      relatedAlertId: json['relatedAlertId']?.toString(),
      relatedArticleId: json['relatedArticleId']?.toString(),
      relatedQuestionId: json['relatedQuestionId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'body': body,
        'read': read,
        'createdAt': createdAt,
        'type': type,
        if (relatedAlertId != null) 'relatedAlertId': relatedAlertId,
        if (relatedArticleId != null) 'relatedArticleId': relatedArticleId,
        if (relatedQuestionId != null) 'relatedQuestionId': relatedQuestionId,
      };

  NotificationModel copyWith({bool? read}) {
    return NotificationModel(
      id: id,
      title: title,
      body: body,
      read: read ?? this.read,
      createdAt: createdAt,
      type: type,
      relatedAlertId: relatedAlertId,
      relatedArticleId: relatedArticleId,
      relatedQuestionId: relatedQuestionId,
    );
  }
}

class PhotoModel {
  PhotoModel({
    required this.id,
    required this.fieldName,
    required this.imageUrl,
    required this.disease,
    required this.capturedAt,
    this.confidence,
    this.fieldId,
    this.lat,
    this.lng,
    this.syncStatus = 'local',
    this.remoteId,
  });

  final String id;
  final String fieldName;
  final String imageUrl;
  final String disease;
  final String capturedAt;
  final double? confidence;
  final String? fieldId;
  final double? lat;
  final double? lng;
  /// local | pending | synced | error
  final String syncStatus;
  final String? remoteId;

  factory PhotoModel.fromJson(Map<String, dynamic> json) {
    return PhotoModel(
      id: json['id'] as String,
      fieldName: json['fieldName'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? '',
      disease: json['disease'] as String? ?? '',
      capturedAt: json['capturedAt'] as String? ?? '',
      confidence: (json['confidence'] as num?)?.toDouble(),
      fieldId: json['fieldId'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      syncStatus: json['syncStatus'] as String? ?? 'local',
      remoteId: json['remoteId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'fieldName': fieldName,
        'imageUrl': imageUrl,
        'disease': disease,
        'capturedAt': capturedAt,
        'confidence': confidence,
        'fieldId': fieldId,
        'lat': lat,
        'lng': lng,
        'syncStatus': syncStatus,
        'remoteId': remoteId,
      };

  PhotoModel copyWith({
    String? syncStatus,
    String? remoteId,
    String? imageUrl,
  }) {
    return PhotoModel(
      id: id,
      fieldName: fieldName,
      imageUrl: imageUrl ?? this.imageUrl,
      disease: disease,
      capturedAt: capturedAt,
      confidence: confidence,
      fieldId: fieldId,
      lat: lat,
      lng: lng,
      syncStatus: syncStatus ?? this.syncStatus,
      remoteId: remoteId ?? this.remoteId,
    );
  }

  /// Local file path when offline; previously a remote URL.
  bool get isLocalFile =>
      imageUrl.isNotEmpty &&
      !imageUrl.startsWith('http://') &&
      !imageUrl.startsWith('https://');

  bool get needsUpload =>
      syncStatus == 'pending' || syncStatus == 'error';
}

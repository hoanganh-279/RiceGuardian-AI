class FieldModel {
  FieldModel({
    required this.id,
    required this.name,
    required this.areaHa,
    required this.variety,
    required this.currentSeason,
    this.lat,
    this.lng,
    this.boundaryGeojson,
    this.coverUrl,
    this.coverOutline,
    this.blbMaskUrl,
    this.blbDiseasePct,
  });

  final String id;
  final String name;
  final double areaHa;
  final String variety;
  final String currentSeason;
  final double? lat;
  final double? lng;
  final dynamic boundaryGeojson;
  final String? coverUrl;
  final dynamic coverOutline;
  final String? blbMaskUrl;
  final double? blbDiseasePct;

  factory FieldModel.fromJson(Map<String, dynamic> json) {
    return FieldModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      areaHa: (json['areaHa'] as num?)?.toDouble() ?? 0,
      variety: json['variety'] as String? ?? '',
      currentSeason: json['currentSeason'] as String? ?? '',
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      boundaryGeojson: json['boundaryGeojson'],
      coverUrl: json['coverUrl'] as String? ?? json['coverImageUrl'] as String?,
      coverOutline: json['coverOutline'],
      blbMaskUrl: json['blbMaskUrl'] as String?,
      blbDiseasePct: (json['blbDiseasePct'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'areaHa': areaHa,
        'variety': variety,
        'currentSeason': currentSeason,
        'lat': lat,
        'lng': lng,
        'boundaryGeojson': boundaryGeojson,
        'coverUrl': coverUrl,
        'coverOutline': coverOutline,
        'blbMaskUrl': blbMaskUrl,
        'blbDiseasePct': blbDiseasePct,
      };
}

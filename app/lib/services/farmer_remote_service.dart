import 'dart:io';

import '../models/article_model.dart';
import '../models/field_model.dart';
import '../models/notification_model.dart';
import '../models/photo_model.dart';
import 'api_client.dart';
import 'app_exception.dart';
import 'auth_service.dart';
import 'local_store.dart';

/// Farmer remote APIs when [AuthService.usesRemoteAuth] is true.
class FarmerRemoteService {
  FarmerRemoteService(this._auth);

  final AuthService _auth;

  ApiClient get _api => _auth.api;
  LocalStore get _store => _auth.store;

  Future<List<FieldModel>> fetchFields({int page = 1, int limit = 50}) async {
    final payload = await _api.get('/api/farmer/fields?page=$page&limit=$limit');
    final items = payload['items'];
    if (items is! List) return [];
    return items
        .whereType<Map>()
        .map((e) => FieldModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<NotificationModel>> fetchNotifications({
    int page = 1,
    int limit = 50,
  }) async {
    final payload =
        await _api.get('/api/farmer/notifications?page=$page&limit=$limit');
    final items = payload['items'];
    if (items is! List) return [];
    return items
        .whereType<Map>()
        .map((e) => NotificationModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> markNotificationRead(String id) async {
    await _api.patch('/api/farmer/notifications/$id/read');
  }

  Future<List<ArticleModel>> fetchArticles({
    int page = 1,
    int limit = 20,
    String category = '',
  }) async {
    final params = StringBuffer('page=$page&limit=$limit');
    if (category.isNotEmpty) params.write('&category=$category');
    final payload = await _api.get('/api/farmer/articles?$params');
    final items = payload['items'];
    if (items is! List) return [];
    return items
        .whereType<Map>()
        .map((e) => ArticleModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<ArticleModel> fetchArticle(String id) async {
    final payload = await _api.get('/api/farmer/articles/$id');
    return ArticleModel.fromJson(Map<String, dynamic>.from(payload as Map));
  }

  Future<ArticleQuestionModel> askArticleQuestion(
    String articleId,
    String body,
  ) async {
    final payload = await _api.post(
      '/api/farmer/articles/$articleId/questions',
      body: {'body': body},
    );
    return ArticleQuestionModel.fromJson(
      Map<String, dynamic>.from(payload as Map),
    );
  }

  Future<List<ArticleQuestionModel>> fetchMyQuestions({
    int page = 1,
    int limit = 50,
    String status = '',
  }) async {
    final params = StringBuffer('page=$page&limit=$limit');
    if (status.isNotEmpty) params.write('&status=$status');
    final payload = await _api.get('/api/farmer/article-questions/me?$params');
    final items = payload['items'];
    if (items is! List) return [];
    return items
        .whereType<Map>()
        .map(
          (e) => ArticleQuestionModel.fromJson(Map<String, dynamic>.from(e)),
        )
        .toList();
  }

  Future<ArticleQuestionModel> fetchMyQuestion(String id) async {
    final payload = await _api.get('/api/farmer/article-questions/$id');
    return ArticleQuestionModel.fromJson(
      Map<String, dynamic>.from(payload as Map),
    );
  }

  Future<PhotoModel> uploadPhoto(PhotoModel photo) async {
    final fieldId = photo.fieldId;
    if (fieldId == null || fieldId.isEmpty) {
      throw ApiException('Thiếu fieldId để đồng bộ ảnh.');
    }
    if (!photo.isLocalFile || !File(photo.imageUrl).existsSync()) {
      throw ApiException('Không tìm thấy file ảnh local để upload.');
    }

    final fields = <String, String>{
      'fieldId': fieldId,
      'disease': photo.disease,
      if (photo.confidence != null) 'confidence': photo.confidence.toString(),
      if (photo.lat != null) 'lat': photo.lat.toString(),
      if (photo.lng != null) 'lng': photo.lng.toString(),
    };

    final result = await _api.postMultipart(
      '/api/farmer/photos',
      fields: fields,
      fileField: 'image',
      filePath: photo.imageUrl,
      filename: '${photo.id}.jpg',
    );

    final remoteId = result['id']?.toString();
    final remoteUrl = result['imageUrl']?.toString();
    return photo.copyWith(
      syncStatus: 'synced',
      remoteId: remoteId,
      imageUrl: remoteUrl ?? photo.imageUrl,
    );
  }

  Future<int> flushPendingUploads() async {
    final photos = await _store.getPhotos();
    var uploaded = 0;
    final next = <PhotoModel>[];
    for (final photo in photos) {
      if (!photo.needsUpload) {
        next.add(photo);
        continue;
      }
      try {
        final synced = await uploadPhoto(photo);
        next.add(synced);
        uploaded += 1;
      } catch (_) {
        next.add(photo.copyWith(syncStatus: 'error'));
      }
    }
    await _store.savePhotos(next);
    return uploaded;
  }
}

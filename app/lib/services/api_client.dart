import 'dart:convert';

import 'package:http/http.dart' as http;

import 'app_exception.dart';

/// Thin HTTP client for Flask API (JWT bearer).
class ApiClient {
  ApiClient({
    String? baseUrl,
    http.Client? httpClient,
  })  : baseUrl = _normalizeBase(
          baseUrl ??
              const String.fromEnvironment(
                'API_BASE_URL',
                defaultValue: '',
              ),
        ),
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client _http;
  String? accessToken;

  static String _normalizeBase(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return '';
    return trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed;
  }

  /// Online only when built with `--dart-define=API_BASE_URL=...`; otherwise offline demo.
  bool get isConfigured => baseUrl.isNotEmpty;

  Uri _uri(String path) {
    final normalized = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$normalized');
  }

  Map<String, String> _headers({bool auth = true, bool jsonBody = true}) {
    final headers = <String, String>{
      if (jsonBody) 'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (auth && accessToken != null && accessToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $accessToken';
    }
    return headers;
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _send(
      () => _http.post(
        _uri(path),
        headers: _headers(auth: auth),
        body: body == null ? null : jsonEncode(body),
      ),
    );
  }

  Future<Map<String, dynamic>> get(String path, {bool auth = true}) async {
    return _send(
      () => _http.get(_uri(path), headers: _headers(auth: auth, jsonBody: false)),
    );
  }

  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _send(
      () => _http.patch(
        _uri(path),
        headers: _headers(auth: auth),
        body: body == null ? null : jsonEncode(body),
      ),
    );
  }

  /// Multipart POST (e.g. farmer photo upload). Returns decoded JSON map.
  Future<Map<String, dynamic>> postMultipart(
    String path, {
    required Map<String, String> fields,
    required String fileField,
    required String filePath,
    String? filename,
    bool auth = true,
  }) async {
    if (!isConfigured) {
      throw ApiException('Chưa cấu hình API_BASE_URL.');
    }
    final request = http.MultipartRequest('POST', _uri(path));
    request.headers.addAll(_headers(auth: auth, jsonBody: false));
    request.fields.addAll(fields);
    request.files.add(
      await http.MultipartFile.fromPath(
        fileField,
        filePath,
        filename: filename,
      ),
    );
    late http.StreamedResponse streamed;
    try {
      streamed = await _http.send(request);
    } catch (err) {
      throw ApiException('Không kết nối được máy chủ: $err');
    }
    final response = await http.Response.fromStream(streamed);
    return _decodeResponse(response);
  }

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() call) async {
    if (!isConfigured) {
      throw ApiException('Chưa cấu hình API_BASE_URL.');
    }
    late http.Response response;
    try {
      response = await call();
    } catch (err) {
      throw ApiException('Không kết nối được máy chủ: $err');
    }
    return _decodeResponse(response);
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    Map<String, dynamic>? payload;
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          payload = decoded;
        }
      } catch (_) {
        payload = {'error': response.body};
      }
    }

    if (response.statusCode >= 400) {
      final message = payload?['error']?.toString() ??
          payload?['message']?.toString() ??
          'Yêu cầu thất bại (${response.statusCode}).';
      throw ApiException(message, statusCode: response.statusCode);
    }

    return payload ?? <String, dynamic>{};
  }

  void dispose() {
    _http.close();
  }
}

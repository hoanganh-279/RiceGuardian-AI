/// Public Google OAuth Web client id (safe in the app — not the client secret).
/// Used as google_sign_in serverClientId so the backend can verify idToken audience.
const String kGoogleServerClientId =
    String.fromEnvironment(
      'GOOGLE_SERVER_CLIENT_ID',
      defaultValue:
          '953961241555-4239gt60jg5ln954s3qd3p3dmm8ul8fj.apps.googleusercontent.com',
    );

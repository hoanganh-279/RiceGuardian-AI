/// Model class name (`class_indices.json`) → Vietnamese label shown in the app.
const Map<String, String> kModelClassToVi = {
  'Bacterial Leaf Blight': 'Bạc lá',
  'Brown Spot': 'Đốm nâu',
  'Healthy Rice Leaf': 'Khỏe mạnh',
  'Leaf Blast': 'Đạo ôn lá',
  'Leaf scald': 'Cháy lá',
  'Narrow Brown Leaf Spot': 'Đốm nâu hẹp',
  'Rice Hispa': 'Hispa',
  'Sheath Blight': 'Khô vằn',
};

String viLabelForModelClass(String modelClass) =>
    kModelClassToVi[modelClass] ?? modelClass;

/// Vietnamese label → disease catalog code. "Khô vằn" has no catalog entry yet.
/// "Than lá" / "Đạo ôn cổ bông" are kept for photos saved by the previous model.
const Map<String, String> kDiseaseNameToCode = {
  'Bạc lá': 'Rice__BacterialLeafBlight',
  'Đốm nâu': 'Rice__BrownSpot',
  'Khỏe mạnh': 'Rice__Healthy',
  'Hispa': 'Rice__Hispa',
  'Đạo ôn lá': 'Rice__LeafBlast',
  'Cháy lá': 'Rice__LeafScald',
  'Than lá': 'Rice__LeafSmut',
  'Đốm nâu hẹp': 'Rice__NarrowBrownLeafSpot',
  'Đạo ôn cổ bông': 'Rice__NeckBlast',
};

String? diseaseCodeForNameVi(String? nameVi) {
  if (nameVi == null || nameVi.trim().isEmpty) return null;
  final exact = kDiseaseNameToCode[nameVi.trim()];
  if (exact != null) return exact;
  for (final entry in kDiseaseNameToCode.entries) {
    if (nameVi.contains(entry.key)) return entry.value;
  }
  return null;
}

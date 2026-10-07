String _two(int v) => v.toString().padLeft(2, '0');

/// `HH:mm · dd/MM/yyyy` in local time; returns [iso] unchanged if unparsable.
String formatDateTime(String iso) {
  final t = DateTime.tryParse(iso)?.toLocal();
  if (t == null) return iso;
  return '${_two(t.hour)}:${_two(t.minute)} · ${_two(t.day)}/${_two(t.month)}/${t.year}';
}

/// `dd/MM/yyyy`; returns [iso] unchanged if unparsable.
String formatDate(String iso) {
  final t = DateTime.tryParse(iso);
  if (t == null) return iso;
  return '${_two(t.day)}/${_two(t.month)}/${t.year}';
}

/// Group header: "Hôm nay" / "Hôm qua" / `dd/MM/yyyy`.
String dateGroupLabel(String iso, {DateTime? now}) {
  final t = DateTime.tryParse(iso)?.toLocal();
  if (t == null) return 'Trước đó';
  final today = now ?? DateTime.now();
  final d = DateTime(t.year, t.month, t.day);
  final base = DateTime(today.year, today.month, today.day);
  final diff = base.difference(d).inDays;
  if (diff == 0) return 'Hôm nay';
  if (diff == 1) return 'Hôm qua';
  return '${_two(t.day)}/${_two(t.month)}/${t.year}';
}

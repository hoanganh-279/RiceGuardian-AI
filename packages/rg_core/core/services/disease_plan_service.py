"""Server-backed disease plans (catalog + imported extras)."""

from core.data.disease_catalog import DISEASE_CATALOG, get_disease
from core.extensions import db
from core.models import DiseasePlanAction


def _action_key(text):
    return " ".join(str(text or "").strip().split()).casefold()


def _normalize_action(text):
    return " ".join(str(text or "").strip().split())


def extras_by_code():
    rows = DiseasePlanAction.query.order_by(DiseasePlanAction.created_at.asc()).all()
    out = {}
    for row in rows:
        out.setdefault(row.disease_code, []).append(row.action_text)
    return out


def list_disease_plans(include_healthy=True):
    extras = extras_by_code()
    plans = []
    for row in DISEASE_CATALOG:
        if not include_healthy and row["code"] == "Rice__Healthy":
            continue
        base = list(row["actions"])
        extra = extras.get(row["code"]) or []
        seen = {_action_key(a) for a in base}
        merged = list(base)
        for action in extra:
            key = _action_key(action)
            if key and key not in seen:
                seen.add(key)
                merged.append(action)
        plans.append(
            {
                "code": row["code"],
                "nameVi": row["nameVi"],
                "summary": row["summary"],
                "actions": merged,
            }
        )
    return plans


def solution_with_extras(code_or_name):
    entry = get_disease(code_or_name)
    if not entry:
        return None
    extras = [
        row.action_text
        for row in DiseasePlanAction.query.filter_by(disease_code=entry["code"])
        .order_by(DiseasePlanAction.created_at.asc())
        .all()
    ]
    base = list(entry["actions"])
    seen = {_action_key(a) for a in base}
    merged = list(base)
    for action in extras:
        key = _action_key(action)
        if key and key not in seen:
            seen.add(key)
            merged.append(action)
    return {
        "code": entry["code"],
        "nameVi": entry["nameVi"],
        "summary": entry["summary"],
        "actions": merged,
    }


def append_disease_actions(updates, user=None):
    """
    updates: { disease_code: [action, ...] }
    Returns { added, skippedDup }
    """
    added = 0
    skipped_dup = 0
    for code, actions in (updates or {}).items():
        entry = get_disease(code)
        if not entry or not isinstance(actions, list):
            continue
        code = entry["code"]
        existing = {
            _action_key(a)
            for a in entry["actions"]
        }
        existing.update(
            {
                _action_key(row.action_text)
                for row in DiseasePlanAction.query.filter_by(disease_code=code).all()
            }
        )
        for raw in actions:
            action = _normalize_action(raw)
            key = _action_key(action)
            if not key:
                continue
            if key in existing:
                skipped_dup += 1
                continue
            db.session.add(
                DiseasePlanAction(
                    disease_code=code,
                    action_text=action,
                    created_by=user.id if user else None,
                )
            )
            existing.add(key)
            added += 1
    db.session.commit()
    return {"added": added, "skippedDup": skipped_dup}

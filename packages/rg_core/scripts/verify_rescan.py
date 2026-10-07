"""Smoke-test D6 rescan catalog + technician photo API (SQLite)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DATABASE_URL"] = "sqlite:///riceguardian_verify_rescan.db"

from core import create_app
from core.data.disease_catalog import DISEASE_CATALOG, get_disease, names_match, solution_payload
from core.extensions import db
from core.services.rice_leaf_inference import ModelNotAvailable, default_weights_path, get_model
from core.services.seed import seed_demo_data

app = create_app()
app.config["TESTING"] = True

with app.app_context():
    db.drop_all()
    db.create_all()
    seed_demo_data()

    assert len(DISEASE_CATALOG) == 9
    blight = get_disease("Rice__BacterialLeafBlight")
    assert blight["nameVi"] == "Bạc lá"
    assert get_disease("Đạo ôn cổ bông")["code"] == "Rice__NeckBlast"
    assert names_match("Bạc lá", "Rice__BacterialLeafBlight") is True
    assert names_match("Bạc lá", "Đốm nâu") is False
    solution = solution_payload("Rice__Healthy")
    assert solution["nameVi"] == "Khỏe mạnh"
    assert solution["actions"]

    client = app.test_client()
    denied = client.get("/api/technician/photos")
    assert denied.status_code == 401, denied.get_json()

    login = client.post(
        "/api/auth/login",
        json={"identifier": "ktv@gmail.vn", "password": "Demo@123"},
    )
    assert login.status_code == 200, login.get_json()
    token = login.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    listed = client.get("/api/technician/photos", headers=headers)
    assert listed.status_code == 200
    body = listed.get_json()
    assert "items" in body and "total" in body

    mgr = client.post(
        "/api/auth/login",
        json={"identifier": "manager@gmail.vn", "password": "Demo@123"},
    )
    assert mgr.status_code == 200, mgr.get_json()
    blocked = client.get(
        "/api/technician/photos",
        headers={"Authorization": f"Bearer {mgr.get_json()['access_token']}"},
    )
    assert blocked.status_code == 403

    missing = client.post(
        "/api/technician/photos/00000000-0000-4000-8000-000000000001/rescan",
        headers=headers,
    )
    assert missing.status_code in (404, 503), missing.get_json()

    try:
        get_model()
        print("model loaded:", default_weights_path())
    except ModelNotAvailable as err:
        assert err.status == 503
        print("model missing (expected in MVP): best.pt not present")

print("verify_rescan ok")

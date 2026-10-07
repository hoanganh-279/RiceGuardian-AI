"""Smoke-test A1–A4 and B1 admin users against the Flask test client (SQLite)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "sqlite:///riceguardian_test.db")
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_KEY"] = ""
os.environ["SUPABASE_ANON_KEY"] = ""

from core import create_app
from core.extensions import db
from core.services.seed import seed_demo_data

app = create_app()
app.config["TESTING"] = True

with app.app_context():
    db.drop_all()
    db.create_all()
    seed_demo_data()

client = app.test_client()


def login(identifier, password):
    return client.post(
        "/api/auth/login",
        json={"identifier": identifier, "password": password},
    )


# A1 — three roles
for ident, role, org_count in [
    ("admin@riceguardian.vn", "admin", 0),
    ("0901000002", "manager", 1),
    ("ktv@gmail.vn", "technician", 2),
]:
    resp = login(ident, "Demo@123")
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    assert body["user"]["role"] == role
    assert "access_token" in body
    assert isinstance(body["organizations"], list)
    assert len(body["organizations"]) == org_count
    print(f"login ok: {ident} -> {role} ({org_count} orgs)")

# A3 profile + password
ktv = login("ktv@gmail.vn", "Demo@123").get_json()
headers = {"Authorization": f"Bearer {ktv['access_token']}"}
me = client.get("/api/auth/me", headers=headers)
assert me.status_code == 200
assert me.get_json()["user"]["email"] == "ktv@gmail.vn"

patch = client.patch("/api/auth/profile", json={"fullName": "Le Van Khoa"}, headers=headers)
assert patch.status_code == 200

orgs = client.get("/api/me/organizations", headers=headers)
assert orgs.status_code == 200
assert len(orgs.get_json()) == 2
print("A2/A3 ok: KTV sees 2 orgs")

# A4 logout revokes session
out = client.post("/api/auth/logout", headers=headers)
assert out.status_code == 200
me2 = client.get("/api/auth/me", headers=headers)
assert me2.status_code == 401
print("A4 ok: session revoked")

# B1 admin user management (SQLite fallback)
admin = login("admin@riceguardian.vn", "Demo@123").get_json()
admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}
created = client.post(
    "/api/admin/users",
    json={
        "fullName": "Nong dan Test",
        "email": "",
        "phone": "0911111111",
        "role": "farmer",
    },
    headers=admin_headers,
)
assert created.status_code == 201, created.get_json()
item = created.get_json()
assert item["role"] == "farmer"
assert item["temporaryPassword"] == "Demo@123"
farmer_login = login("0911111111", item["temporaryPassword"])
assert farmer_login.status_code == 200, farmer_login.get_json()

locked = client.post(f"/api/admin/users/{item['id']}/lock", headers=admin_headers)
assert locked.status_code == 200
assert locked.get_json()["status"] == "locked"
blocked = login("0911111111", "Demo@123")
assert blocked.status_code == 403

client.post(f"/api/admin/users/{item['id']}/lock", headers=admin_headers)
reset = client.post(f"/api/admin/users/{item['id']}/reset-password", headers=admin_headers)
assert reset.status_code == 200
temp = reset.get_json()["temporaryPassword"]
again = login("0911111111", temp)
assert again.status_code == 200, again.get_json()

deleted = client.delete(f"/api/admin/users/{item['id']}", headers=admin_headers)
assert deleted.status_code == 200
gone = login("0911111111", temp)
assert gone.status_code == 401
print("B1 ok: admin create/lock/reset/delete farmer")

# lockout after 5 failures
for i in range(5):
    fail = login("admin@riceguardian.vn", "wrong")
    assert fail.status_code == 401
locked = login("admin@riceguardian.vn", "Demo@123")
assert locked.status_code == 423, locked.get_json()
print("lockout ok: 423 after 5 failures")

print("ALL CHECKS PASSED")

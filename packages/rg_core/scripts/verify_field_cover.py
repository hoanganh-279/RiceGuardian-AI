import json
import requests

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
    b"\x00\x00\x00\x03\x00\x01\x00\x05\xfe\xd4\xef\x00\x00\x00\x00IEND\xaeB`\x82"
)

base = "http://127.0.0.1:5000"
login = requests.post(base + "/api/auth/login", json={"identifier": "ktv@gmail.vn", "password": "123456@"})
if login.status_code == 401:
    login = requests.post(base + "/api/auth/login", json={"identifier": "ktv@gmail.vn", "password": "Demo@123"})
print("login", login.status_code, login.text[:400])
login.raise_for_status()
token = login.json().get("access_token") or login.json().get("token")
headers = {"Authorization": "Bearer " + token}
board = requests.get(base + "/api/technician/fields", headers=headers)
print("board", board.status_code)
payload = board.json()
print("board items", len(payload.get("items") or []), [row.get("id") for row in (payload.get("items") or [])])
items = payload.get("items") or []
assert items, "no fields"
fid = items[0]["id"]

up = requests.post(
    base + f"/api/technician/fields/{fid}/cover",
    headers=headers,
    files={"image": ("cover.png", PNG, "image/png")},
    data={"source": "upload"},
)
print("upload", up.status_code, (up.text[:400]).encode("ascii", "replace").decode("ascii"))
up.raise_for_status()
data = up.json()
assert data.get("coverUrl"), data
assert data.get("coverSource") == "upload", data

uav = requests.post(
    base + f"/api/technician/fields/{fid}/cover",
    headers=headers,
    files={"image": ("uav-cover.png", PNG, "image/png")},
    data={"source": "uav"},
)
print("uav", uav.status_code, (uav.text[:400]).encode("ascii", "replace").decode("ascii"))
uav.raise_for_status()
uav_data = uav.json()
assert uav_data.get("coverUrl"), uav_data
assert uav_data.get("coverSource") == "uav", uav_data

detail = requests.get(base + f"/api/technician/fields/{fid}", headers=headers)
print("detail cover", detail.json().get("coverUrl"), detail.json().get("coverSource"))
assert detail.json().get("coverUrl") == uav_data["coverUrl"]
assert detail.json().get("coverSource") == "uav"

ol = requests.put(
    base + f"/api/technician/fields/{fid}/cover/outline",
    headers=headers,
    json={"points": "10,10 90,10 90,90 10,90"},
)
print("outline", ol.status_code, ol.json().get("coverOutline"))
assert ol.json().get("coverOutline", {}).get("points")
assert ol.json().get("coverSource") == "uav", ol.json()

crop = requests.post(
    base + f"/api/technician/fields/{fid}/cover/crop",
    headers=headers,
    files={"image": ("crop-cover.png", PNG, "image/png")},
)
print("crop", crop.status_code, crop.json().get("coverSource"))
crop.raise_for_status()
assert crop.json().get("coverSource") == "uav", crop.json()

img = requests.get(uav_data["coverUrl"])
print("file", img.status_code, img.headers.get("content-type"), len(img.content))
assert img.status_code == 200
print("OK", fid)

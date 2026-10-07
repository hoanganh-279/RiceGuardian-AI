# RiceGuardian AI

Nền tảng AIoT dự báo sớm bệnh hại và quản lý canh tác lúa.

| Thư mục | Vai trò | Công nghệ |
|---|---|---|
| `web/` | Website quản trị (admin / manager / technician) | React + Vite + Bootstrap 5 |
| `app/` | App nông dân (farmer) | Flutter, nhận diện bệnh on-device (TFLite) |
| `backend/` | Entrypoint API: `run.py` (web, port 5001), `run_app.py` (app, port 5000) | Flask |
| `packages/rg_core/` | Code nghiệp vụ dùng chung cho backend (`import core`) | Flask + SQLAlchemy |

## Yêu cầu

- Python 3.10+
- Node.js 18+
- Flutter SDK (theo `app/pubspec.yaml`)

## 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
```

Mặc định (không đặt `DATABASE_URL`) cả hai API dùng chung SQLite `packages/rg_core/instance/riceguardian.db` và tự seed dữ liệu demo. Muốn dùng chung database PostgreSQL (Supabase) của nhóm: xin `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` qua kênh riêng và điền vào `backend/.env` — **không commit file `.env`**.

Chạy hai API (mỗi lệnh một terminal, cùng venv):

```bash
python run.py        # web admin  → http://127.0.0.1:5001/api/health
python run_app.py    # app nông dân → http://127.0.0.1:5000/api/health
```

## 2. Web admin

```bash
cd web
npm install
echo VITE_LIVE_API=1 > .env.local
npm run dev                     # http://localhost:5173
```

Vite proxy `/api` và `/uploads` sang `:5001`. Bỏ `VITE_LIVE_API=1` để chạy giao diện với dữ liệu mock (không cần backend).

## 3. App nông dân

```bash
cd app
flutter pub get
```

| Thiết bị | Lệnh |
|---|---|
| Android emulator | `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000` |
| Điện thoại thật (USB) | `adb reverse tcp:5000 tcp:5000` rồi `flutter run --dart-define=API_BASE_URL=http://127.0.0.1:5000` |
| Điện thoại cùng WiFi | `flutter run --dart-define=API_BASE_URL=http://<IP-máy-tính>:5000` |

Không truyền `API_BASE_URL` → app chạy offline (dữ liệu lưu trên máy, demo `0901234567` / `Demo@123`). Nhận diện bệnh luôn chạy on-device bằng model trong `app/assets/models/`.

## Tài khoản demo (database SQLite seed)

| Vai trò | Đăng nhập | Mật khẩu | Dùng ở |
|---|---|---|---|
| Admin | `admin@riceguardian.vn` | `123456@` | Web |
| Manager | `manager@gmail.vn` | `123456@` | Web |
| Technician | `ktv@gmail.vn` | `123456@` | Web |
| Farmer | `0901234567` | `123456@` | App (online) |

## Model AI

- App: `app/assets/models/*.tflite` — đã có trong repo.
- Web (phân vùng bạc lá từ ảnh UAV đa phổ): `best.pth` ~619 MB, **không** có trong repo. Xin file từ nhóm, đặt tại `web/blb_uav_seg_ms_d2/` (kèm `config.json`) hoặc sửa `BLB_UAV_SEG_MODEL_PATH` trong `backend/.env`. Thiếu model thì các chức năng khác vẫn chạy bình thường.

Chi tiết thêm: `backend/README.md`, `web/README.md`, `app/README.md`.

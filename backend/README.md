# Backend API — local

Two entrypoints share one `.env`, one database and one `uploads/` folder:

| Entrypoint | Profile | Port | Audience | Routes |
|---|---|---|---|---|
| `run.py` | `web` | **5001** (`PORT`) | Web admin (`web/`) | `/api/auth/*`, `/api/me/*`, `/api/technician/*`, `/api/admin/*`, articles |
| `run_app.py` | `app` | **5000** (`APP_PORT`) | Farmer app (`app/`) | `/api/auth/*`, `/api/me/*`, `/api/farmer/*` + Socket.IO |

Both expose `/api/health`.

Shared code: `packages/rg_core` (`PYTHONPATH` set in `run.py`).

## Run (Windows)

```bash
cd E:\riceguardian-ai\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Smoke: open `http://127.0.0.1:5001/api/health` → `{"status":"ok","profile":"web"}`.

### BLB model

Set `BLB_UAV_SEG_MODEL_PATH` in `.env` to the multispectral 6-channel bundle (`band_mode: D2_MS_NDVI`):

```text
BLB_UAV_SEG_MODEL_PATH=../web/blb_uav_seg_ms_d2/best.pth
BLB_MS_PREVIEW_BANDS=0,1,2
```

(`config.json` must be next to `best.pth`, ~619 MB, not committed — `**/*.pth` is gitignored.) If unset, the app also tries `backend/blb_uav_seg_ms_d2/best.pth` then `web/blb_uav_seg_ms_d2/best.pth`.

Input contract:

- Only stacked GeoTIFF/TIFF with **exactly 6 channels** (CHW or HWC) is analyzed. JPG/PNG is stored as cover only (API returns `blbWarning`).
- Channel order is **not verified** by the API — the uploader must provide the same order as training (5 DJI P4 Multispectral bands + NDVI).
- Per tile (256 px, stride 224): per-channel min-max `(x - min) / (max - min + 1e-6)`.
- `BLB_MS_PREVIEW_BANDS` picks 3 band indices (0–5) for the display-only preview PNG; it does not affect inference.
- Crop on a TIFF cover crops the TIFF itself by the drawn rectangle; draw an outline afterwards to analyze.

Torch install is large; first `pip install` may take several minutes. CPU inference on large TIFFs is slow (ResNet-101).

Smoke (synthetic noise, pipeline only — not accuracy):

```bash
set RG_BACKEND_ROOT=E:\riceguardian-ai\backend
.venv\Scripts\python ..\packages\rg_core\scripts\verify_blb_uav_seg.py
```

### Demo users (SQLite seed)

| Email | Password | Role |
|---|---|---|
| `ktv@gmail.vn` | `123456@` | technician |
| `manager@gmail.vn` | `123456@` | manager |
| `admin@riceguardian.vn` | `123456@` | admin |

## Pair with web admin

```bash
# Terminal 1 — this API
cd E:\riceguardian-ai\backend
.venv\Scripts\activate
python run.py

# Terminal 2 — Vite
cd E:\riceguardian-ai\web
# web/.env.local → VITE_LIVE_API=1  (VITE_API_URL empty = proxy)
npm run dev
```

Then login as KTV → field detail → "Liên kết ảnh UAV đa phổ (TIFF 6 kênh)" → crop (optional) → draw outline → BLB mask.

## Pair with farmer app

```bash
# Terminal 3 — farmer API (same venv, same .env)
cd E:\riceguardian-ai\backend
.venv\Scripts\activate
python run_app.py
```

Smoke: `http://127.0.0.1:5000/api/health` → `{"status":"ok","profile":"app"}`. Demo farmer: `0901234567` / `123456@`.

Run the app with `--dart-define=API_BASE_URL=...` (see root `README.md`). Without it the app stays offline.

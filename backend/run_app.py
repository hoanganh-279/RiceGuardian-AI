"""Farmer mobile app API — profile=app, default port 5000."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_ROOT.parent
RG_CORE = REPO_ROOT / "packages" / "rg_core"

load_dotenv(BACKEND_ROOT / ".env")

import sys

sys.path.insert(0, str(RG_CORE))

from core import create_app  # noqa: E402
from core import realtime  # noqa: E402

app = create_app(profile="app", backend_root=str(BACKEND_ROOT))

if __name__ == "__main__":
    port = int(os.getenv("APP_PORT", "5000"))
    realtime.socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=app.config.get("DEBUG", False),
        allow_unsafe_werkzeug=True,
    )

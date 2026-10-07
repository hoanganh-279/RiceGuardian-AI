"""Staff / web admin API — profile=web, default port 5001."""

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

app = create_app(profile="web", backend_root=str(BACKEND_ROOT))

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=app.config.get("DEBUG", False))

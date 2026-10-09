"""Marketing site API — profile=site, default port 5002."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_ROOT.parents[1]
RG_CORE = REPO_ROOT / "packages" / "rg_core"

load_dotenv(BACKEND_ROOT / ".env")

import sys

sys.path.insert(0, str(RG_CORE))

from core import create_app  # noqa: E402

app = create_app(profile="site", backend_root=str(BACKEND_ROOT))

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5002"))
    app.run(host="0.0.0.0", port=port, debug=app.config.get("DEBUG", False))

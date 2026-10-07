# rg_core — shared Flask library

Python package name remains `core` (imports: `from core...`).

Entrypoints that import `rg_core`:

- `backend/run.py` — `create_app(profile="web")`, staff API for `web/` (port 5001)
- `backend/run_app.py` — `create_app(profile="app")`, farmer API for `app/` (port 5000)

```python
from core import create_app
app = create_app(profile="site"|"web"|"app", backend_root="...")
```

| Profile | Blueprints |
|---------|------------|
| `site` | `/api/site` |
| `web` | auth, me, technician, admin, articles |
| `app` | auth, me, farmer + Socket.IO |
| `all` | everything (tests) |

Not a deployable HTTP service on its own — run it through the `backend/` entrypoints.

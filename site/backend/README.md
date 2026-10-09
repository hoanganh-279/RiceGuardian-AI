# Site API (marketing)

Audience: website giới thiệu (`site/`). Routes: `/api/site/*`, `/api/health`.

```bash
cd site/backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # điền SMTP + SITE_GOOGLE_* + DATABASE_URL
python run.py            # http://0.0.0.0:5002
```

Shared code: `packages/rg_core` (PYTHONPATH set in `run.py`).
Same Postgres as web/app APIs. Schema owner for contact tables: this service applies site patches; full migrate owned by `web/backend`.

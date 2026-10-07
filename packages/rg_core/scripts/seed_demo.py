"""Run once to insert demo users (or use Supabase migration seed)."""

from core import create_app
from core.services.seed import seed_demo_data

app = create_app()
with app.app_context():
    created = seed_demo_data()
    print("Seeded demo users." if created else "Demo users already exist.")

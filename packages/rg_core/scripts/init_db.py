from core import create_app
from core.extensions import db
from core.services.seed import seed_demo_data

app = create_app()
with app.app_context():
    db.create_all()
    created = seed_demo_data()
    print("Created tables and seeded demo data." if created else "Tables ready; demo data already exists.")

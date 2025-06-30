import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from models import db, Stat
from flask import Flask

app = Flask(__name__)
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../instance/data.db'))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    stats = Stat.query.filter(Stat.bmr != None).order_by(Stat.date.desc()).all()
    print(f"{'Date':<12} {'BMR':<6}")
    print('-' * 20)
    for stat in stats:
        print(f"{stat.date} {stat.bmr}") 
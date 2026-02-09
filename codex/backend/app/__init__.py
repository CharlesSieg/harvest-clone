import os
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/consultant")
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "/app/uploads")
    app.config["SMTP_HOST"] = os.getenv("SMTP_HOST", "mailhog")
    app.config["SMTP_PORT"] = int(os.getenv("SMTP_PORT", "1025"))

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    CORS(app)
    db.init_app(app)

    from .models import ExpenseCategory
    from .routes import register_routes

    with app.app_context():
        db.create_all()
        if ExpenseCategory.query.count() == 0:
            for name in ["Entertainment", "Meals", "Lodging", "Mileage", "Transportation", "Other"]:
                db.session.add(ExpenseCategory(name=name, archived=False))
            db.session.commit()

    register_routes(app)

    return app

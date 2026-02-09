import os
from flask import Flask
from flask_cors import CORS
from models import db

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', 'postgresql://harvest:harvest123@localhost:5433/harvest'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.environ.get('UPLOAD_FOLDER', 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20MB

    CORS(app)
    db.init_app(app)

    from routes import settings, clients, tasks, expense_categories, projects, time_entries, expenses, invoices, reports
    app.register_blueprint(settings.bp)
    app.register_blueprint(clients.bp)
    app.register_blueprint(tasks.bp)
    app.register_blueprint(expense_categories.bp)
    app.register_blueprint(projects.bp)
    app.register_blueprint(time_entries.bp)
    app.register_blueprint(expenses.bp)
    app.register_blueprint(invoices.bp)
    app.register_blueprint(reports.bp)

    with app.app_context():
        db.create_all()
        from seed import seed_data
        seed_data()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)

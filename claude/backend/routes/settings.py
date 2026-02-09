from flask import Blueprint, request, jsonify
from models import db, Settings

bp = Blueprint('settings', __name__)


@bp.route('/api/settings', methods=['GET'])
def get_settings():
    s = Settings.query.first()
    if not s:
        s = Settings(company_name='My Company', default_billable_rate=150.00)
        db.session.add(s)
        db.session.commit()
    return jsonify(s.to_dict())


@bp.route('/api/settings', methods=['PUT'])
def update_settings():
    s = Settings.query.first()
    if not s:
        s = Settings()
        db.session.add(s)
    data = request.json
    for field in ['company_name', 'address', 'city', 'state', 'zip_code', 'phone', 'email', 'default_billable_rate']:
        if field in data:
            setattr(s, field, data[field])
    db.session.commit()
    return jsonify(s.to_dict())

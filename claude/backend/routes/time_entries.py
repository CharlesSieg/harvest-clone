from flask import Blueprint, request, jsonify
from models import db, TimeEntry
from datetime import date, timedelta
import calendar

bp = Blueprint('time_entries', __name__)


@bp.route('/api/time-entries', methods=['GET'])
def list_time_entries():
    start = request.args.get('start_date')
    end = request.args.get('end_date')
    project_id = request.args.get('project_id')
    q = TimeEntry.query
    if start:
        q = q.filter(TimeEntry.date >= date.fromisoformat(start))
    if end:
        q = q.filter(TimeEntry.date <= date.fromisoformat(end))
    if project_id:
        q = q.filter_by(project_id=int(project_id))
    entries = q.order_by(TimeEntry.date).all()
    return jsonify([e.to_dict() for e in entries])


@bp.route('/api/time-entries', methods=['POST'])
def create_time_entry():
    data = request.json
    entry = TimeEntry(
        date=date.fromisoformat(data['date']),
        hours=data['hours'],
        project_id=data['project_id'],
        task_id=data['task_id'],
        notes=data.get('notes', ''),
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@bp.route('/api/time-entries/<int:entry_id>', methods=['PUT'])
def update_time_entry(entry_id):
    entry = TimeEntry.query.get_or_404(entry_id)
    data = request.json
    if 'date' in data:
        entry.date = date.fromisoformat(data['date'])
    if 'hours' in data:
        entry.hours = data['hours']
    if 'project_id' in data:
        entry.project_id = data['project_id']
    if 'task_id' in data:
        entry.task_id = data['task_id']
    if 'notes' in data:
        entry.notes = data['notes']
    db.session.commit()
    return jsonify(entry.to_dict())


@bp.route('/api/time-entries/<int:entry_id>', methods=['DELETE'])
def delete_time_entry(entry_id):
    entry = TimeEntry.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@bp.route('/api/time-entries/fill-month', methods=['POST'])
def fill_month():
    data = request.json
    year = data['year']
    month = data['month']
    hours = data['hours']
    project_id = data['project_id']
    task_id = data['task_id']

    _, num_days = calendar.monthrange(year, month)
    created = []
    for day in range(1, num_days + 1):
        d = date(year, month, day)
        if d.weekday() < 5:  # Monday=0 to Friday=4
            existing = TimeEntry.query.filter_by(
                date=d, project_id=project_id, task_id=task_id
            ).first()
            if existing:
                existing.hours = hours
                created.append(existing)
            else:
                entry = TimeEntry(
                    date=d, hours=hours, project_id=project_id, task_id=task_id
                )
                db.session.add(entry)
                created.append(entry)
    db.session.commit()
    return jsonify([e.to_dict() for e in created]), 201

from flask import Blueprint, request, jsonify
from models import db, Task, TimeEntry

bp = Blueprint('tasks', __name__)


@bp.route('/api/tasks', methods=['GET'])
def list_tasks():
    include_archived = request.args.get('include_archived', 'false')
    q = Task.query.order_by(Task.name)
    if include_archived != 'true':
        q = q.filter_by(archived=False)
    tasks = q.all()
    return jsonify([t.to_dict() for t in tasks])


@bp.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json
    task = Task(
        name=data['name'],
        billable_rate=data.get('billable_rate', 0),
    )
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201


@bp.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.json
    for field in ['name', 'billable_rate']:
        if field in data:
            setattr(task, field, data[field])
    db.session.commit()
    return jsonify(task.to_dict())


@bp.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    has_time = TimeEntry.query.filter_by(task_id=task_id).first()
    if has_time:
        return jsonify({'error': 'Cannot delete task with time entries'}), 400
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@bp.route('/api/tasks/<int:task_id>/archive', methods=['PUT'])
def archive_task(task_id):
    task = Task.query.get_or_404(task_id)
    task.archived = not task.archived
    db.session.commit()
    return jsonify(task.to_dict())

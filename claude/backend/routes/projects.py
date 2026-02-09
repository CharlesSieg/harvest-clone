from flask import Blueprint, request, jsonify
from models import db, Project, Task, TimeEntry
from datetime import date

bp = Blueprint('projects', __name__)


@bp.route('/api/projects', methods=['GET'])
def list_projects():
    status = request.args.get('status', 'all')  # all, active, archived
    client_id = request.args.get('client_id')
    q = Project.query
    if status == 'active':
        q = q.filter_by(archived=False)
    elif status == 'archived':
        q = q.filter_by(archived=True)
    if client_id:
        q = q.filter_by(client_id=int(client_id))
    projects = q.order_by(Project.name).all()
    return jsonify([p.to_dict() for p in projects])


@bp.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    project = Project(
        client_id=data['client_id'],
        name=data['name'],
        code=data.get('code', ''),
        start_date=date.fromisoformat(data['start_date']) if data.get('start_date') else None,
        end_date=date.fromisoformat(data['end_date']) if data.get('end_date') else None,
        notes=data.get('notes', ''),
    )
    if 'task_ids' in data:
        tasks = Task.query.filter(Task.id.in_(data['task_ids'])).all()
        project.tasks = tasks
    db.session.add(project)
    db.session.commit()
    return jsonify(project.to_dict()), 201


@bp.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify(project.to_dict())


@bp.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.json
    for field in ['client_id', 'name', 'code', 'notes']:
        if field in data:
            setattr(project, field, data[field])
    if 'start_date' in data:
        project.start_date = date.fromisoformat(data['start_date']) if data['start_date'] else None
    if 'end_date' in data:
        project.end_date = date.fromisoformat(data['end_date']) if data['end_date'] else None
    if 'task_ids' in data:
        tasks = Task.query.filter(Task.id.in_(data['task_ids'])).all()
        project.tasks = tasks
    db.session.commit()
    return jsonify(project.to_dict())


@bp.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)
    has_time = TimeEntry.query.filter_by(project_id=project_id).first()
    if has_time:
        return jsonify({'error': 'Cannot delete project with time entries'}), 400
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@bp.route('/api/projects/<int:project_id>/archive', methods=['PUT'])
def archive_project(project_id):
    project = Project.query.get_or_404(project_id)
    project.archived = not project.archived
    db.session.commit()
    return jsonify(project.to_dict())


@bp.route('/api/projects/<int:project_id>/duplicate', methods=['POST'])
def duplicate_project(project_id):
    original = Project.query.get_or_404(project_id)
    new_project = Project(
        client_id=original.client_id,
        name=f"{original.name} (Copy)",
        code=original.code,
        start_date=original.start_date,
        end_date=original.end_date,
        notes=original.notes,
    )
    new_project.tasks = list(original.tasks)
    db.session.add(new_project)
    db.session.commit()
    return jsonify(new_project.to_dict()), 201

import os
import uuid
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from models import db, Expense
from datetime import date

bp = Blueprint('expenses', __name__)


@bp.route('/api/expenses', methods=['GET'])
def list_expenses():
    project_id = request.args.get('project_id')
    q = Expense.query
    if project_id:
        q = q.filter_by(project_id=int(project_id))
    expenses = q.order_by(Expense.date.desc()).all()
    return jsonify([e.to_dict() for e in expenses])


@bp.route('/api/expenses', methods=['POST'])
def create_expense():
    d = request.form.get('date') or (request.json or {}).get('date')
    project_id = request.form.get('project_id') or (request.json or {}).get('project_id')
    category_id = request.form.get('category_id') or (request.json or {}).get('category_id')
    notes = request.form.get('notes', '') or (request.json or {}).get('notes', '')
    amount = request.form.get('amount') or (request.json or {}).get('amount')

    file_path = None
    if 'file' in request.files:
        f = request.files['file']
        if f.filename:
            ext = os.path.splitext(f.filename)[1]
            filename = f"{uuid.uuid4().hex}{ext}"
            upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
            os.makedirs(upload_dir, exist_ok=True)
            f.save(os.path.join(upload_dir, filename))
            file_path = filename

    expense = Expense(
        date=date.fromisoformat(d),
        project_id=int(project_id),
        category_id=int(category_id),
        notes=notes,
        amount=float(amount),
        file_path=file_path,
    )
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense.to_dict()), 201


@bp.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)

    if request.content_type and 'multipart' in request.content_type:
        if request.form.get('date'):
            expense.date = date.fromisoformat(request.form['date'])
        if request.form.get('project_id'):
            expense.project_id = int(request.form['project_id'])
        if request.form.get('category_id'):
            expense.category_id = int(request.form['category_id'])
        if request.form.get('notes') is not None:
            expense.notes = request.form['notes']
        if request.form.get('amount'):
            expense.amount = float(request.form['amount'])
        if 'file' in request.files:
            f = request.files['file']
            if f.filename:
                ext = os.path.splitext(f.filename)[1]
                filename = f"{uuid.uuid4().hex}{ext}"
                upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
                os.makedirs(upload_dir, exist_ok=True)
                f.save(os.path.join(upload_dir, filename))
                expense.file_path = filename
    else:
        data = request.json
        if 'date' in data:
            expense.date = date.fromisoformat(data['date'])
        for field in ['project_id', 'category_id', 'notes', 'amount']:
            if field in data:
                setattr(expense, field, data[field])

    db.session.commit()
    return jsonify(expense.to_dict())


@bp.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@bp.route('/uploads/<path:filename>', methods=['GET'])
def get_upload(filename):
    upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    return send_from_directory(upload_dir, filename)

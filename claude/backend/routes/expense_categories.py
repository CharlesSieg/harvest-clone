from flask import Blueprint, request, jsonify
from models import db, ExpenseCategory, Expense

bp = Blueprint('expense_categories', __name__)


@bp.route('/api/expense-categories', methods=['GET'])
def list_categories():
    include_archived = request.args.get('include_archived', 'false')
    q = ExpenseCategory.query.order_by(ExpenseCategory.name)
    if include_archived != 'true':
        q = q.filter_by(archived=False)
    categories = q.all()
    return jsonify([c.to_dict() for c in categories])


@bp.route('/api/expense-categories', methods=['POST'])
def create_category():
    data = request.json
    cat = ExpenseCategory(name=data['name'])
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@bp.route('/api/expense-categories/<int:cat_id>', methods=['PUT'])
def update_category(cat_id):
    cat = ExpenseCategory.query.get_or_404(cat_id)
    data = request.json
    if 'name' in data:
        cat.name = data['name']
    db.session.commit()
    return jsonify(cat.to_dict())


@bp.route('/api/expense-categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    cat = ExpenseCategory.query.get_or_404(cat_id)
    has_expenses = Expense.query.filter_by(category_id=cat_id).first()
    if has_expenses:
        return jsonify({'error': 'Cannot delete category with expenses'}), 400
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@bp.route('/api/expense-categories/<int:cat_id>/archive', methods=['PUT'])
def archive_category(cat_id):
    cat = ExpenseCategory.query.get_or_404(cat_id)
    cat.archived = not cat.archived
    db.session.commit()
    return jsonify(cat.to_dict())

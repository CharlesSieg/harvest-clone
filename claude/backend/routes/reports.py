from flask import Blueprint, request, jsonify, make_response
from models import db, Invoice, Client
from datetime import date
import csv
import io

bp = Blueprint('reports', __name__)


@bp.route('/api/reports/invoices', methods=['GET'])
def invoices_report():
    client_id = request.args.get('client_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    active_only = request.args.get('active_clients', 'false')
    sort_by = request.args.get('sort_by', 'client_name')
    sort_dir = request.args.get('sort_dir', 'asc')

    q = Invoice.query.join(Client)
    if client_id:
        q = q.filter(Invoice.client_id == int(client_id))
    if start_date:
        q = q.filter(Invoice.issue_date >= date.fromisoformat(start_date))
    if end_date:
        q = q.filter(Invoice.issue_date <= date.fromisoformat(end_date))
    if active_only == 'true':
        q = q.filter(Client.active == True)

    invoices = q.all()

    result = []
    for inv in invoices:
        total_hours = sum(float(li.quantity) for li in inv.line_items if li.line_type == 'time')
        result.append({
            'id': inv.id,
            'invoice_number': inv.invoice_number,
            'client_name': inv.client.name if inv.client else '',
            'issue_date': inv.issue_date.isoformat(),
            'total_hours': total_hours,
            'amount': float(inv.total_amount or 0),
            'status': inv.status,
        })

    if sort_by == 'client_name':
        result.sort(key=lambda x: x['client_name'].lower(), reverse=(sort_dir == 'desc'))
    elif sort_by == 'amount':
        result.sort(key=lambda x: x['amount'], reverse=(sort_dir == 'desc'))

    return jsonify(result)


@bp.route('/api/reports/invoices/csv', methods=['GET'])
def invoices_csv():
    client_id = request.args.get('client_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    active_only = request.args.get('active_clients', 'false')

    q = Invoice.query.join(Client)
    if client_id:
        q = q.filter(Invoice.client_id == int(client_id))
    if start_date:
        q = q.filter(Invoice.issue_date >= date.fromisoformat(start_date))
    if end_date:
        q = q.filter(Invoice.issue_date <= date.fromisoformat(end_date))
    if active_only == 'true':
        q = q.filter(Client.active == True)

    invoices = q.order_by(Client.name, Invoice.issue_date).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Invoice #', 'Client', 'Issue Date', 'Hours', 'Amount', 'Status'])

    for inv in invoices:
        total_hours = sum(float(li.quantity) for li in inv.line_items if li.line_type == 'time')
        writer.writerow([
            inv.invoice_number,
            inv.client.name if inv.client else '',
            inv.issue_date.isoformat(),
            f'{total_hours:.2f}',
            f'{float(inv.total_amount or 0):.2f}',
            inv.status,
        ])

    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = 'attachment; filename=invoices_report.csv'
    return response


@bp.route('/api/reports/accounts-receivable', methods=['GET'])
def accounts_receivable():
    invoices = Invoice.query.filter(
        Invoice.status.in_(['sent', 'draft'])
    ).join(Client).order_by(Client.name).all()

    result = []
    for inv in invoices:
        days_outstanding = (date.today() - inv.issue_date).days
        days_until_due = (inv.due_date - date.today()).days
        result.append({
            'id': inv.id,
            'invoice_number': inv.invoice_number,
            'client_name': inv.client.name if inv.client else '',
            'issue_date': inv.issue_date.isoformat(),
            'due_date': inv.due_date.isoformat(),
            'amount': float(inv.total_amount or 0),
            'status': inv.status,
            'days_outstanding': days_outstanding,
            'days_until_due': days_until_due,
            'is_overdue': days_until_due < 0,
        })

    return jsonify(result)

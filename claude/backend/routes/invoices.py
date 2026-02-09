from flask import Blueprint, request, jsonify, make_response
from models import db, Invoice, InvoiceLineItem, InvoiceHistory, TimeEntry, Expense, Client, Settings
from datetime import date, datetime, timedelta
from collections import defaultdict
from fpdf import FPDF
import io
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

bp = Blueprint('invoices', __name__)


@bp.route('/api/invoices', methods=['GET'])
def list_invoices():
    client_id = request.args.get('client_id')
    status = request.args.get('status')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    q = Invoice.query
    if client_id:
        q = q.filter_by(client_id=int(client_id))
    if status:
        q = q.filter_by(status=status)
    if start_date:
        q = q.filter(Invoice.issue_date >= date.fromisoformat(start_date))
    if end_date:
        q = q.filter(Invoice.issue_date <= date.fromisoformat(end_date))
    invoices = q.order_by(Invoice.issue_date.desc()).all()
    result = []
    for inv in invoices:
        d = inv.to_dict()
        days_until_due = (inv.due_date - date.today()).days
        if inv.status == 'draft':
            d['due_status'] = 'Draft'
        elif inv.status == 'paid':
            d['due_status'] = 'Paid'
        elif inv.status == 'written_off':
            d['due_status'] = 'Written Off'
        elif days_until_due < 0:
            d['due_status'] = f'Overdue by {abs(days_until_due)} days'
        else:
            d['due_status'] = f'Due in {days_until_due} days'
        result.append(d)
    return jsonify(result)


@bp.route('/api/invoices/uninvoiced', methods=['GET'])
def get_uninvoiced():
    client_id = request.args.get('client_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    project_ids = request.args.getlist('project_ids')

    if not client_id:
        return jsonify({'error': 'client_id required'}), 400

    from models import Project
    project_q = Project.query.filter_by(client_id=int(client_id))
    if project_ids:
        project_q = project_q.filter(Project.id.in_([int(p) for p in project_ids]))
    projects = project_q.all()
    pids = [p.id for p in projects]

    time_q = TimeEntry.query.filter(
        TimeEntry.project_id.in_(pids),
        TimeEntry.invoice_id.is_(None)
    )
    if start_date:
        time_q = time_q.filter(TimeEntry.date >= date.fromisoformat(start_date))
    if end_date:
        time_q = time_q.filter(TimeEntry.date <= date.fromisoformat(end_date))
    time_entries = time_q.order_by(TimeEntry.date).all()

    expense_q = Expense.query.filter(
        Expense.project_id.in_(pids),
        Expense.invoice_id.is_(None)
    )
    expenses = expense_q.order_by(Expense.date).all()

    return jsonify({
        'time_entries': [t.to_dict() for t in time_entries],
        'expenses': [e.to_dict() for e in expenses],
        'projects': [p.to_dict() for p in projects],
    })


@bp.route('/api/invoices', methods=['POST'])
def create_invoice():
    data = request.json
    client = Client.query.get_or_404(data['client_id'])

    invoice = Invoice(
        client_id=data['client_id'],
        invoice_number=data['invoice_number'],
        po_number=data.get('po_number', ''),
        issue_date=date.fromisoformat(data['issue_date']),
        due_date=date.fromisoformat(data['due_date']),
        subject=data.get('subject', ''),
        notes=data.get('notes', ''),
        status='draft',
    )
    db.session.add(invoice)
    db.session.flush()

    total = 0.0

    # Process time entries - group by week
    time_entry_ids = data.get('time_entry_ids', [])
    if time_entry_ids:
        entries = TimeEntry.query.filter(TimeEntry.id.in_(time_entry_ids)).all()
        weeks = defaultdict(list)
        for entry in entries:
            # Get Monday of the week
            monday = entry.date - timedelta(days=entry.date.weekday())
            weeks[monday].append(entry)

        for week_start in sorted(weeks.keys()):
            week_entries = weeks[week_start]
            week_end = week_start + timedelta(days=6)
            hours = sum(float(e.hours) for e in week_entries)
            # Use the task's billable rate
            rate = float(week_entries[0].task.billable_rate) if week_entries[0].task else 0
            amount = hours * rate
            total += amount

            li = InvoiceLineItem(
                invoice_id=invoice.id,
                description=f"Week of {week_start.strftime('%b %d')} - {week_end.strftime('%b %d, %Y')}",
                quantity=hours,
                rate=rate,
                amount=amount,
                line_type='time',
                week_start=week_start,
            )
            db.session.add(li)

            for entry in week_entries:
                entry.invoice_id = invoice.id

    # Process expenses
    expense_ids = data.get('expense_ids', [])
    if expense_ids:
        expenses = Expense.query.filter(Expense.id.in_(expense_ids)).all()
        for exp in expenses:
            amount = float(exp.amount)
            total += amount
            li = InvoiceLineItem(
                invoice_id=invoice.id,
                description=f"Expense: {exp.category.name} - {exp.notes}" if exp.notes else f"Expense: {exp.category.name}",
                quantity=1,
                rate=amount,
                amount=amount,
                line_type='expense',
                expense_id=exp.id,
            )
            db.session.add(li)
            exp.invoice_id = invoice.id

    invoice.total_amount = total

    history = InvoiceHistory(
        invoice_id=invoice.id,
        action='created',
        notes='Invoice created',
    )
    db.session.add(history)
    db.session.commit()

    return jsonify(invoice.to_dict(include_items=True)), 201


@bp.route('/api/invoices/<int:invoice_id>', methods=['GET'])
def get_invoice(invoice_id):
    invoice = Invoice.query.get_or_404(invoice_id)
    return jsonify(invoice.to_dict(include_items=True))


@bp.route('/api/invoices/<int:invoice_id>', methods=['PUT'])
def update_invoice(invoice_id):
    invoice = Invoice.query.get_or_404(invoice_id)
    data = request.json
    for field in ['invoice_number', 'po_number', 'subject', 'notes']:
        if field in data:
            setattr(invoice, field, data[field])
    if 'issue_date' in data:
        invoice.issue_date = date.fromisoformat(data['issue_date'])
    if 'due_date' in data:
        invoice.due_date = date.fromisoformat(data['due_date'])
    if 'status' in data:
        invoice.status = data['status']

    history = InvoiceHistory(
        invoice_id=invoice.id,
        action='updated',
        notes='Invoice updated',
    )
    db.session.add(history)
    db.session.commit()
    return jsonify(invoice.to_dict(include_items=True))


@bp.route('/api/invoices/<int:invoice_id>', methods=['DELETE'])
def delete_invoice(invoice_id):
    invoice = Invoice.query.get_or_404(invoice_id)
    # Unmark time entries and expenses
    TimeEntry.query.filter_by(invoice_id=invoice_id).update({'invoice_id': None})
    Expense.query.filter_by(invoice_id=invoice_id).update({'invoice_id': None})
    db.session.delete(invoice)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


@bp.route('/api/invoices/<int:invoice_id>/write-off', methods=['PUT'])
def write_off_invoice(invoice_id):
    invoice = Invoice.query.get_or_404(invoice_id)
    invoice.status = 'written_off'
    history = InvoiceHistory(
        invoice_id=invoice.id,
        action='written_off',
        notes='Invoice written off',
    )
    db.session.add(history)
    db.session.commit()
    return jsonify(invoice.to_dict(include_items=True))


@bp.route('/api/invoices/<int:invoice_id>/send', methods=['POST'])
def send_invoice(invoice_id):
    invoice = Invoice.query.get_or_404(invoice_id)
    invoice.status = 'sent'
    history = InvoiceHistory(
        invoice_id=invoice.id,
        action='sent',
        notes='Invoice marked as sent',
    )
    db.session.add(history)
    db.session.commit()
    return jsonify(invoice.to_dict(include_items=True))


def generate_invoice_pdf(invoice):
    settings = Settings.query.first()
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Header
    pdf.set_font('Helvetica', 'B', 20)
    pdf.cell(0, 10, 'INVOICE', ln=True, align='R')
    pdf.ln(5)

    # Company info
    pdf.set_font('Helvetica', '', 10)
    if settings:
        pdf.cell(0, 5, settings.company_name, ln=True)
        if settings.address:
            pdf.cell(0, 5, settings.address, ln=True)
        city_state = ', '.join(filter(None, [settings.city, settings.state, settings.zip_code]))
        if city_state:
            pdf.cell(0, 5, city_state, ln=True)
        if settings.email:
            pdf.cell(0, 5, settings.email, ln=True)
        if settings.phone:
            pdf.cell(0, 5, settings.phone, ln=True)
    pdf.ln(10)

    # Client info
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(0, 5, 'Bill To:', ln=True)
    pdf.set_font('Helvetica', '', 10)
    if invoice.client:
        pdf.cell(0, 5, invoice.client.name, ln=True)
        if invoice.client.address:
            pdf.cell(0, 5, invoice.client.address, ln=True)
        city_state = ', '.join(filter(None, [invoice.client.city, invoice.client.state, invoice.client.zip_code]))
        if city_state:
            pdf.cell(0, 5, city_state, ln=True)
    pdf.ln(10)

    # Invoice details
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(95, 5, f'Invoice #: {invoice.invoice_number}', ln=False)
    pdf.cell(95, 5, f'Issue Date: {invoice.issue_date.strftime("%b %d, %Y")}', ln=True)
    if invoice.po_number:
        pdf.cell(95, 5, f'PO #: {invoice.po_number}', ln=False)
    else:
        pdf.cell(95, 5, '', ln=False)
    pdf.cell(95, 5, f'Due Date: {invoice.due_date.strftime("%b %d, %Y")}', ln=True)
    if invoice.subject:
        pdf.cell(0, 5, f'Subject: {invoice.subject}', ln=True)
    pdf.ln(10)

    # Line items table header
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(80, 8, 'Description', border=1, fill=True)
    pdf.cell(25, 8, 'Qty/Hours', border=1, fill=True, align='R')
    pdf.cell(35, 8, 'Rate', border=1, fill=True, align='R')
    pdf.cell(40, 8, 'Amount', border=1, fill=True, align='R')
    pdf.ln()

    # Line items
    pdf.set_font('Helvetica', '', 9)
    for li in invoice.line_items:
        pdf.cell(80, 7, li.description[:50], border=1)
        pdf.cell(25, 7, f'{li.quantity:.2f}', border=1, align='R')
        pdf.cell(35, 7, f'${li.rate:,.2f}', border=1, align='R')
        pdf.cell(40, 7, f'${li.amount:,.2f}', border=1, align='R')
        pdf.ln()

    # Total
    pdf.ln(5)
    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(140, 10, 'Total:', align='R')
    pdf.cell(40, 10, f'${float(invoice.total_amount):,.2f}', align='R')
    pdf.ln()

    # Notes
    if invoice.notes:
        pdf.ln(10)
        pdf.set_font('Helvetica', '', 9)
        pdf.multi_cell(0, 5, f'Notes: {invoice.notes}')

    return pdf.output()


@bp.route('/api/invoices/<int:invoice_id>/pdf', methods=['GET'])
def get_invoice_pdf(invoice_id):
    invoice = Invoice.query.get_or_404(invoice_id)
    pdf_bytes = generate_invoice_pdf(invoice)
    response = make_response(pdf_bytes)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'attachment; filename=invoice_{invoice.invoice_number}.pdf'
    return response

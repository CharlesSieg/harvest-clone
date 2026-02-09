from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date

db = SQLAlchemy()

project_tasks = db.Table('project_tasks',
    db.Column('project_id', db.Integer, db.ForeignKey('projects.id'), primary_key=True),
    db.Column('task_id', db.Integer, db.ForeignKey('tasks.id'), primary_key=True)
)


class Settings(db.Model):
    __tablename__ = 'settings'
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(200), default='')
    address = db.Column(db.String(500), default='')
    city = db.Column(db.String(100), default='')
    state = db.Column(db.String(100), default='')
    zip_code = db.Column(db.String(20), default='')
    phone = db.Column(db.String(50), default='')
    email = db.Column(db.String(200), default='')
    default_billable_rate = db.Column(db.Numeric(10, 2), default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'company_name': self.company_name,
            'address': self.address,
            'city': self.city,
            'state': self.state,
            'zip_code': self.zip_code,
            'phone': self.phone,
            'email': self.email,
            'default_billable_rate': float(self.default_billable_rate or 0),
        }


class Client(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.String(500), default='')
    city = db.Column(db.String(100), default='')
    state = db.Column(db.String(100), default='')
    zip_code = db.Column(db.String(20), default='')
    currency = db.Column(db.String(10), default='USD')
    invoice_due_days = db.Column(db.Integer, default=30)
    active = db.Column(db.Boolean, default=True)
    contacts = db.relationship('Contact', backref='client', lazy=True, cascade='all, delete-orphan')
    projects = db.relationship('Project', backref='client', lazy=True)

    def to_dict(self, include_contacts=True):
        d = {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'city': self.city,
            'state': self.state,
            'zip_code': self.zip_code,
            'currency': self.currency,
            'invoice_due_days': self.invoice_due_days,
            'active': self.active,
        }
        if include_contacts:
            d['contacts'] = [c.to_dict() for c in self.contacts]
        return d


class Contact(db.Model):
    __tablename__ = 'contacts'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    first_name = db.Column(db.String(100), default='')
    last_name = db.Column(db.String(100), default='')
    email = db.Column(db.String(200), default='')
    title = db.Column(db.String(200), default='')
    office_phone = db.Column(db.String(50), default='')
    mobile_phone = db.Column(db.String(50), default='')
    fax = db.Column(db.String(50), default='')

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'title': self.title,
            'office_phone': self.office_phone,
            'mobile_phone': self.mobile_phone,
            'fax': self.fax,
        }


class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    billable_rate = db.Column(db.Numeric(10, 2), default=0)
    archived = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'billable_rate': float(self.billable_rate or 0),
            'archived': self.archived,
        }


class ExpenseCategory(db.Model):
    __tablename__ = 'expense_categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    archived = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'archived': self.archived,
        }


class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), default='')
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, default='')
    archived = db.Column(db.Boolean, default=False)
    tasks = db.relationship('Task', secondary=project_tasks, lazy='subquery',
                            backref=db.backref('projects', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'client_name': self.client.name if self.client else '',
            'name': self.name,
            'code': self.code,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'notes': self.notes,
            'archived': self.archived,
            'tasks': [t.to_dict() for t in self.tasks],
        }


class TimeEntry(db.Model):
    __tablename__ = 'time_entries'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    hours = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    notes = db.Column(db.Text, default='')
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=True)
    project = db.relationship('Project', backref='time_entries')
    task = db.relationship('Task', backref='time_entries')

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'hours': float(self.hours),
            'project_id': self.project_id,
            'task_id': self.task_id,
            'project_name': self.project.name if self.project else '',
            'client_name': self.project.client.name if self.project and self.project.client else '',
            'task_name': self.task.name if self.task else '',
            'notes': self.notes,
            'invoice_id': self.invoice_id,
        }


class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('expense_categories.id'), nullable=False)
    notes = db.Column(db.Text, default='')
    amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    file_path = db.Column(db.String(500), nullable=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=True)
    project = db.relationship('Project', backref='expenses')
    category = db.relationship('ExpenseCategory', backref='expenses')

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'project_id': self.project_id,
            'project_name': self.project.name if self.project else '',
            'client_name': self.project.client.name if self.project and self.project.client else '',
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else '',
            'notes': self.notes,
            'amount': float(self.amount),
            'file_path': self.file_path,
            'invoice_id': self.invoice_id,
        }


class Invoice(db.Model):
    __tablename__ = 'invoices'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    invoice_number = db.Column(db.String(50), nullable=False)
    po_number = db.Column(db.String(50), default='')
    issue_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    subject = db.Column(db.String(500), default='')
    notes = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default='draft')  # draft, sent, paid, written_off
    total_amount = db.Column(db.Numeric(10, 2), default=0)
    client = db.relationship('Client', backref='invoices')
    line_items = db.relationship('InvoiceLineItem', backref='invoice', lazy=True, cascade='all, delete-orphan')
    history = db.relationship('InvoiceHistory', backref='invoice', lazy=True, cascade='all, delete-orphan',
                              order_by='InvoiceHistory.timestamp')

    def to_dict(self, include_items=False):
        d = {
            'id': self.id,
            'client_id': self.client_id,
            'client_name': self.client.name if self.client else '',
            'invoice_number': self.invoice_number,
            'po_number': self.po_number,
            'issue_date': self.issue_date.isoformat(),
            'due_date': self.due_date.isoformat(),
            'subject': self.subject,
            'notes': self.notes,
            'status': self.status,
            'total_amount': float(self.total_amount or 0),
        }
        if include_items:
            d['line_items'] = [li.to_dict() for li in self.line_items]
            d['history'] = [h.to_dict() for h in self.history]
        return d


class InvoiceLineItem(db.Model):
    __tablename__ = 'invoice_line_items'
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    description = db.Column(db.String(500), default='')
    quantity = db.Column(db.Numeric(10, 2), default=0)
    rate = db.Column(db.Numeric(10, 2), default=0)
    amount = db.Column(db.Numeric(10, 2), default=0)
    line_type = db.Column(db.String(20), default='time')  # time, expense
    week_start = db.Column(db.Date, nullable=True)
    expense_id = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'invoice_id': self.invoice_id,
            'description': self.description,
            'quantity': float(self.quantity or 0),
            'rate': float(self.rate or 0),
            'amount': float(self.amount or 0),
            'line_type': self.line_type,
            'week_start': self.week_start.isoformat() if self.week_start else None,
            'expense_id': self.expense_id,
        }


class InvoiceHistory(db.Model):
    __tablename__ = 'invoice_history'
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text, default='')

    def to_dict(self):
        return {
            'id': self.id,
            'invoice_id': self.invoice_id,
            'action': self.action,
            'timestamp': self.timestamp.isoformat(),
            'notes': self.notes,
        }

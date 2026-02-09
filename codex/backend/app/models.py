from datetime import date, datetime
from . import db


class Client(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    address = db.Column(db.Text, default="")
    currency = db.Column(db.String(8), default="USD")
    due_days = db.Column(db.Integer, default=30)
    active = db.Column(db.Boolean, default=True)


class Contact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey("client.id"), nullable=False)
    first_name = db.Column(db.String(120), nullable=False)
    last_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    title = db.Column(db.String(120), default="")
    office_phone = db.Column(db.String(40), default="")
    mobile_phone = db.Column(db.String(40), default="")
    fax = db.Column(db.String(40), default="")


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey("client.id"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    code = db.Column(db.String(80), default="")
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, default="")
    active = db.Column(db.Boolean, default=True)
    archived = db.Column(db.Boolean, default=False)


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    billable_rate = db.Column(db.Float, nullable=False)
    archived = db.Column(db.Boolean, default=False)


class ProjectTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey("task.id"), nullable=False)


class TimeEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey("task.id"), nullable=False)
    entry_date = db.Column(db.Date, nullable=False, default=date.today)
    hours = db.Column(db.Float, nullable=False)
    invoiced = db.Column(db.Boolean, default=False)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoice.id"), nullable=True)


class ExpenseCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    archived = db.Column(db.Boolean, default=False)


class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    expense_date = db.Column(db.Date, nullable=False, default=date.today)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("expense_category.id"), nullable=False)
    notes = db.Column(db.Text, default="")
    amount = db.Column(db.Float, nullable=False)
    attachment = db.Column(db.String(500), default="")
    invoiced = db.Column(db.Boolean, default=False)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoice.id"), nullable=True)


class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_identifier = db.Column(db.String(120), nullable=False)
    po_number = db.Column(db.String(120), default="")
    client_id = db.Column(db.Integer, db.ForeignKey("client.id"), nullable=False)
    issue_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    subject = db.Column(db.String(255), default="")
    notes = db.Column(db.Text, default="")
    status = db.Column(db.String(40), default="draft")
    written_off = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InvoiceLineItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoice.id"), nullable=False)
    item_type = db.Column(db.String(40), nullable=False)  # time|expense
    description = db.Column(db.String(255), nullable=False)
    hours = db.Column(db.Float, default=0)
    rate = db.Column(db.Float, default=0)
    amount = db.Column(db.Float, nullable=False)


class InvoiceHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoice.id"), nullable=False)
    event = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Setting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(255), default="My Consulting Company")
    address = db.Column(db.Text, default="")
    contact_info = db.Column(db.Text, default="")
    default_billable_rate = db.Column(db.Float, default=100.0)

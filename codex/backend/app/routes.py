import csv
import io
import os
import smtplib
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from functools import wraps

from dateutil.relativedelta import relativedelta
from flask import jsonify, request, send_file
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from werkzeug.utils import secure_filename

from . import db
from .models import (
    Client,
    Contact,
    Expense,
    ExpenseCategory,
    Invoice,
    InvoiceHistory,
    InvoiceLineItem,
    Project,
    ProjectTask,
    Setting,
    Task,
    TimeEntry,
)


def register_routes(app):
    def parse_date(value):
        if not value:
            return None
        return datetime.strptime(value, "%Y-%m-%d").date()

    def model_to_dict(obj):
        out = {}
        for col in obj.__table__.columns:
            v = getattr(obj, col.name)
            if isinstance(v, (date, datetime)):
                out[col.name] = v.isoformat()
            else:
                out[col.name] = v
        return out

    def safe_json(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001
                db.session.rollback()
                return jsonify({"error": str(exc)}), 400

        return wrapper

    def invoice_total(invoice_id):
        return sum(x.amount for x in InvoiceLineItem.query.filter_by(invoice_id=invoice_id).all())

    def invoice_due_days(inv):
        return (inv.due_date - date.today()).days

    def create_pdf_for_invoice(invoice_id):
        inv = Invoice.query.get_or_404(invoice_id)
        client = Client.query.get_or_404(inv.client_id)
        settings = Setting.query.first() or Setting()
        lines = InvoiceLineItem.query.filter_by(invoice_id=invoice_id).all()
        out_path = f"/tmp/invoice-{invoice_id}.pdf"

        c = canvas.Canvas(out_path, pagesize=letter)
        width, height = letter
        y = height - 40

        c.setFont("Helvetica-Bold", 16)
        c.drawString(40, y, settings.company_name)
        y -= 20
        c.setFont("Helvetica", 10)
        c.drawString(40, y, f"Invoice {inv.invoice_identifier}")
        y -= 16
        c.drawString(40, y, f"Client: {client.name}")
        y -= 16
        c.drawString(40, y, f"Issue: {inv.issue_date.isoformat()}  Due: {inv.due_date.isoformat()}")
        y -= 24

        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, "Description")
        c.drawString(350, y, "Hours")
        c.drawString(420, y, "Rate")
        c.drawString(500, y, "Amount")
        y -= 14
        c.setFont("Helvetica", 10)

        for line in lines:
            c.drawString(40, y, line.description[:50])
            c.drawRightString(390, y, f"{line.hours:.2f}" if line.hours else "-")
            c.drawRightString(470, y, f"{line.rate:.2f}" if line.rate else "-")
            c.drawRightString(560, y, f"{line.amount:.2f}")
            y -= 14
            if y < 100:
                c.showPage()
                y = height - 40

        y -= 14
        c.setFont("Helvetica-Bold", 12)
        c.drawRightString(560, y, f"Total Due: {invoice_total(invoice_id):.2f}")
        c.save()
        return out_path

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})

    @app.get("/api/bootstrap")
    def bootstrap():
        return jsonify(
            {
                "clients": [model_to_dict(x) for x in Client.query.order_by(Client.name).all()],
                "contacts": [model_to_dict(x) for x in Contact.query.order_by(Contact.id).all()],
                "projects": [model_to_dict(x) for x in Project.query.order_by(Project.id.desc()).all()],
                "tasks": [model_to_dict(x) for x in Task.query.order_by(Task.name).all()],
                "project_tasks": [model_to_dict(x) for x in ProjectTask.query.order_by(ProjectTask.id).all()],
                "categories": [model_to_dict(x) for x in ExpenseCategory.query.order_by(ExpenseCategory.name).all()],
                "settings": model_to_dict(Setting.query.first() or Setting()),
            }
        )

    @app.get("/api/clients")
    def clients_list():
        return jsonify([model_to_dict(x) for x in Client.query.order_by(Client.name).all()])

    @app.post("/api/clients")
    @safe_json
    def clients_create():
        payload = request.json
        c = Client(
            name=payload["name"],
            address=payload.get("address", ""),
            currency=payload.get("currency", "USD"),
            due_days=int(payload.get("due_days", 30)),
            active=payload.get("active", True),
        )
        db.session.add(c)
        db.session.commit()
        return jsonify(model_to_dict(c))

    @app.put("/api/clients/<int:client_id>")
    @safe_json
    def clients_update(client_id):
        c = Client.query.get_or_404(client_id)
        payload = request.json
        for field in ["name", "address", "currency", "due_days", "active"]:
            if field in payload:
                setattr(c, field, payload[field])
        db.session.commit()
        return jsonify(model_to_dict(c))

    @app.delete("/api/clients/<int:client_id>")
    @safe_json
    def clients_delete(client_id):
        if Project.query.filter_by(client_id=client_id).count() > 0:
            return jsonify({"error": "Cannot delete client with projects"}), 400
        c = Client.query.get_or_404(client_id)
        db.session.delete(c)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/clients/<int:client_id>/contacts")
    def contacts_list(client_id):
        return jsonify([model_to_dict(x) for x in Contact.query.filter_by(client_id=client_id).all()])

    @app.post("/api/clients/<int:client_id>/contacts")
    @safe_json
    def contacts_create(client_id):
        payload = request.json
        contact = Contact(
            client_id=client_id,
            first_name=payload["first_name"],
            last_name=payload["last_name"],
            email=payload["email"],
            title=payload.get("title", ""),
            office_phone=payload.get("office_phone", ""),
            mobile_phone=payload.get("mobile_phone", ""),
            fax=payload.get("fax", ""),
        )
        db.session.add(contact)
        db.session.commit()
        return jsonify(model_to_dict(contact))

    @app.put("/api/contacts/<int:contact_id>")
    @safe_json
    def contacts_update(contact_id):
        payload = request.json
        c = Contact.query.get_or_404(contact_id)
        for field in ["first_name", "last_name", "email", "title", "office_phone", "mobile_phone", "fax"]:
            if field in payload:
                setattr(c, field, payload[field])
        db.session.commit()
        return jsonify(model_to_dict(c))

    @app.delete("/api/contacts/<int:contact_id>")
    @safe_json
    def contacts_delete(contact_id):
        c = Contact.query.get_or_404(contact_id)
        db.session.delete(c)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/tasks")
    def tasks_list():
        return jsonify([model_to_dict(x) for x in Task.query.order_by(Task.name).all()])

    @app.post("/api/tasks")
    @safe_json
    def tasks_create():
        payload = request.json
        t = Task(name=payload["name"], billable_rate=float(payload["billable_rate"]), archived=payload.get("archived", False))
        db.session.add(t)
        db.session.commit()
        return jsonify(model_to_dict(t))

    @app.put("/api/tasks/<int:task_id>")
    @safe_json
    def tasks_update(task_id):
        payload = request.json
        t = Task.query.get_or_404(task_id)
        for field in ["name", "billable_rate", "archived"]:
            if field in payload:
                setattr(t, field, payload[field])
        db.session.commit()
        return jsonify(model_to_dict(t))

    @app.delete("/api/tasks/<int:task_id>")
    @safe_json
    def tasks_delete(task_id):
        if TimeEntry.query.filter_by(task_id=task_id).count() > 0:
            return jsonify({"error": "Cannot delete task with time entries"}), 400
        t = Task.query.get_or_404(task_id)
        db.session.delete(t)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/expense-categories")
    def categories_list():
        return jsonify([model_to_dict(x) for x in ExpenseCategory.query.order_by(ExpenseCategory.name).all()])

    @app.post("/api/expense-categories")
    @safe_json
    def categories_create():
        payload = request.json
        cat = ExpenseCategory(name=payload["name"], archived=payload.get("archived", False))
        db.session.add(cat)
        db.session.commit()
        return jsonify(model_to_dict(cat))

    @app.put("/api/expense-categories/<int:category_id>")
    @safe_json
    def categories_update(category_id):
        payload = request.json
        c = ExpenseCategory.query.get_or_404(category_id)
        for field in ["name", "archived"]:
            if field in payload:
                setattr(c, field, payload[field])
        db.session.commit()
        return jsonify(model_to_dict(c))

    @app.delete("/api/expense-categories/<int:category_id>")
    @safe_json
    def categories_delete(category_id):
        if Expense.query.filter_by(category_id=category_id).count() > 0:
            return jsonify({"error": "Cannot delete category with expenses"}), 400
        c = ExpenseCategory.query.get_or_404(category_id)
        db.session.delete(c)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/projects")
    def projects_list():
        status = request.args.get("status", "all")
        client_id = request.args.get("client_id")
        q = Project.query
        if status == "active":
            q = q.filter_by(archived=False)
        elif status == "archived":
            q = q.filter_by(archived=True)
        if client_id:
            q = q.filter_by(client_id=client_id)
        projects = [model_to_dict(x) for x in q.order_by(Project.id.desc()).all()]
        for p in projects:
            p["task_ids"] = [pt.task_id for pt in ProjectTask.query.filter_by(project_id=p["id"]).all()]
        return jsonify(projects)

    @app.post("/api/projects")
    @safe_json
    def projects_create():
        payload = request.json
        p = Project(
            client_id=payload["client_id"],
            name=payload["name"],
            code=payload.get("code", ""),
            start_date=parse_date(payload.get("start_date")),
            end_date=parse_date(payload.get("end_date")),
            notes=payload.get("notes", ""),
            archived=payload.get("archived", False),
        )
        db.session.add(p)
        db.session.flush()
        for task_id in payload.get("task_ids", []):
            db.session.add(ProjectTask(project_id=p.id, task_id=task_id))
        db.session.commit()
        out = model_to_dict(p)
        out["task_ids"] = [pt.task_id for pt in ProjectTask.query.filter_by(project_id=p.id).all()]
        return jsonify(out)

    @app.put("/api/projects/<int:project_id>")
    @safe_json
    def projects_update(project_id):
        payload = request.json
        p = Project.query.get_or_404(project_id)
        for field in ["client_id", "name", "code", "notes", "archived", "active"]:
            if field in payload:
                setattr(p, field, payload[field])
        if "start_date" in payload:
            p.start_date = parse_date(payload.get("start_date"))
        if "end_date" in payload:
            p.end_date = parse_date(payload.get("end_date"))
        if "task_ids" in payload:
            ProjectTask.query.filter_by(project_id=project_id).delete()
            for task_id in payload.get("task_ids", []):
                db.session.add(ProjectTask(project_id=project_id, task_id=task_id))
        db.session.commit()
        out = model_to_dict(p)
        out["task_ids"] = [pt.task_id for pt in ProjectTask.query.filter_by(project_id=p.id).all()]
        return jsonify(out)

    @app.post("/api/projects/<int:project_id>/duplicate")
    @safe_json
    def projects_duplicate(project_id):
        original = Project.query.get_or_404(project_id)
        cloned = Project(
            client_id=original.client_id,
            name=f"{original.name} (Copy)",
            code=original.code,
            start_date=original.start_date,
            end_date=original.end_date,
            notes=original.notes,
            active=original.active,
            archived=False,
        )
        db.session.add(cloned)
        db.session.flush()
        for pt in ProjectTask.query.filter_by(project_id=original.id).all():
            db.session.add(ProjectTask(project_id=cloned.id, task_id=pt.task_id))
        db.session.commit()
        return jsonify(model_to_dict(cloned))

    @app.post("/api/projects/<int:project_id>/archive")
    @safe_json
    def projects_archive(project_id):
        p = Project.query.get_or_404(project_id)
        p.archived = True
        db.session.commit()
        return jsonify(model_to_dict(p))

    @app.delete("/api/projects/<int:project_id>")
    @safe_json
    def projects_delete(project_id):
        if TimeEntry.query.filter_by(project_id=project_id).count() > 0:
            return jsonify({"error": "Cannot delete project with recorded time"}), 400
        ProjectTask.query.filter_by(project_id=project_id).delete()
        p = Project.query.get_or_404(project_id)
        db.session.delete(p)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/time-entries")
    def time_entries_list():
        start_date = parse_date(request.args.get("start_date"))
        end_date = parse_date(request.args.get("end_date"))
        q = TimeEntry.query
        if start_date:
            q = q.filter(TimeEntry.entry_date >= start_date)
        if end_date:
            q = q.filter(TimeEntry.entry_date <= end_date)
        return jsonify([model_to_dict(x) for x in q.order_by(TimeEntry.entry_date.desc()).all()])

    @app.post("/api/time-entries")
    @safe_json
    def time_entries_create():
        payload = request.json
        t = TimeEntry(
            project_id=payload["project_id"],
            task_id=payload["task_id"],
            entry_date=parse_date(payload["entry_date"]),
            hours=float(payload["hours"]),
        )
        db.session.add(t)
        db.session.commit()
        return jsonify(model_to_dict(t))

    @app.post("/api/time-entries/month-weekdays")
    @safe_json
    def time_entries_month_weekdays():
        payload = request.json
        month = int(payload["month"])
        year = int(payload["year"])
        hours = float(payload["hours"])
        project_id = int(payload["project_id"])
        task_id = int(payload["task_id"])

        cur = date(year, month, 1)
        end = cur + relativedelta(months=1)
        created = []
        while cur < end:
            if cur.weekday() < 5:
                t = TimeEntry(project_id=project_id, task_id=task_id, entry_date=cur, hours=hours)
                db.session.add(t)
                created.append(t)
            cur += timedelta(days=1)
        db.session.commit()
        return jsonify([model_to_dict(x) for x in created])

    @app.delete("/api/time-entries/<int:entry_id>")
    @safe_json
    def time_entries_delete(entry_id):
        t = TimeEntry.query.get_or_404(entry_id)
        db.session.delete(t)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/expenses")
    def expenses_list():
        return jsonify([model_to_dict(x) for x in Expense.query.order_by(Expense.expense_date.desc()).all()])

    @app.post("/api/expenses")
    @safe_json
    def expenses_create():
        file_name = ""
        if "attachment" in request.files and request.files["attachment"].filename:
            f = request.files["attachment"]
            file_name = f"{datetime.utcnow().timestamp()}-{secure_filename(f.filename)}"
            f.save(os.path.join(app.config["UPLOAD_FOLDER"], file_name))

        e = Expense(
            expense_date=parse_date(request.form["expense_date"]),
            project_id=int(request.form["project_id"]),
            category_id=int(request.form["category_id"]),
            notes=request.form.get("notes", ""),
            amount=float(request.form["amount"]),
            attachment=file_name,
        )
        db.session.add(e)
        db.session.commit()
        return jsonify(model_to_dict(e))

    @app.delete("/api/expenses/<int:expense_id>")
    @safe_json
    def expenses_delete(expense_id):
        e = Expense.query.get_or_404(expense_id)
        db.session.delete(e)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/expenses/<int:expense_id>/attachment")
    def expense_attachment(expense_id):
        e = Expense.query.get_or_404(expense_id)
        if not e.attachment:
            return jsonify({"error": "No attachment"}), 404
        return send_file(os.path.join(app.config["UPLOAD_FOLDER"], e.attachment), as_attachment=True)

    def resolve_time_range(mode, custom_start, custom_end):
        today = date.today()
        if mode == "current_month":
            start = today.replace(day=1)
            end = (start + relativedelta(months=1)) - timedelta(days=1)
            return start, end
        if mode == "last_month":
            end = today.replace(day=1) - timedelta(days=1)
            start = end.replace(day=1)
            return start, end
        if mode == "custom":
            return parse_date(custom_start), parse_date(custom_end)
        return None, None

    @app.post("/api/invoices/preview")
    @safe_json
    def invoices_preview():
        payload = request.json
        client_id = int(payload["client_id"])
        project_ids = payload.get("project_ids", [])
        include_expenses = payload.get("include_expenses", True)
        mode = payload.get("hours_mode", "all")
        start, end = resolve_time_range(mode, payload.get("start_date"), payload.get("end_date"))

        q = TimeEntry.query.join(Project, Project.id == TimeEntry.project_id).filter(Project.client_id == client_id, TimeEntry.invoiced.is_(False))
        if project_ids:
            q = q.filter(TimeEntry.project_id.in_(project_ids))
        if start:
            q = q.filter(TimeEntry.entry_date >= start)
        if end:
            q = q.filter(TimeEntry.entry_date <= end)
        entries = q.all()

        weekly = {}
        for e in entries:
            task = Task.query.get(e.task_id)
            week_start = e.entry_date - timedelta(days=e.entry_date.weekday())
            key = (week_start.isoformat(), task.billable_rate)
            weekly.setdefault(key, {"week": week_start.isoformat(), "hours": 0.0, "rate": task.billable_rate, "amount": 0.0})
            weekly[key]["hours"] += e.hours
            weekly[key]["amount"] += e.hours * task.billable_rate

        expense_rows = []
        if include_expenses:
            eq = Expense.query.join(Project, Project.id == Expense.project_id).filter(Project.client_id == client_id, Expense.invoiced.is_(False))
            if project_ids:
                eq = eq.filter(Expense.project_id.in_(project_ids))
            for e in eq.all():
                expense_rows.append(
                    {
                        "id": e.id,
                        "description": f"Expense #{e.id} ({e.expense_date.isoformat()})",
                        "amount": e.amount,
                    }
                )

        time_rows = list(weekly.values())
        total = sum(x["amount"] for x in time_rows) + sum(x["amount"] for x in expense_rows)
        return jsonify({"time_rows": time_rows, "expense_rows": expense_rows, "total": total, "time_entry_ids": [e.id for e in entries]})

    @app.get("/api/invoices")
    def invoices_list():
        client_id = request.args.get("client_id")
        status = request.args.get("status")
        start_date = parse_date(request.args.get("start_date"))
        end_date = parse_date(request.args.get("end_date"))

        q = Invoice.query
        if client_id:
            q = q.filter_by(client_id=client_id)
        if status and status != "all":
            q = q.filter_by(status=status)
        if start_date:
            q = q.filter(Invoice.issue_date >= start_date)
        if end_date:
            q = q.filter(Invoice.issue_date <= end_date)

        rows = []
        for inv in q.order_by(Invoice.issue_date.desc()).all():
            client = Client.query.get(inv.client_id)
            rows.append(
                {
                    **model_to_dict(inv),
                    "client_name": client.name if client else "Unknown",
                    "amount": invoice_total(inv.id),
                    "due_in_days": invoice_due_days(inv),
                }
            )
        return jsonify(rows)

    @app.get("/api/invoices/<int:invoice_id>")
    def invoice_detail(invoice_id):
        inv = Invoice.query.get_or_404(invoice_id)
        line_items = [model_to_dict(x) for x in InvoiceLineItem.query.filter_by(invoice_id=invoice_id).all()]
        history = [model_to_dict(x) for x in InvoiceHistory.query.filter_by(invoice_id=invoice_id).order_by(InvoiceHistory.created_at.desc()).all()]
        return jsonify({**model_to_dict(inv), "line_items": line_items, "history": history, "total": invoice_total(invoice_id)})

    @app.post("/api/invoices")
    @safe_json
    def invoices_create():
        payload = request.json
        inv = Invoice(
            invoice_identifier=payload["invoice_identifier"],
            po_number=payload.get("po_number", ""),
            client_id=payload["client_id"],
            issue_date=parse_date(payload["issue_date"]),
            due_date=parse_date(payload["due_date"]),
            subject=payload.get("subject", ""),
            notes=payload.get("notes", ""),
            status=payload.get("status", "draft"),
        )
        db.session.add(inv)
        db.session.flush()

        for row in payload.get("time_rows", []):
            db.session.add(
                InvoiceLineItem(
                    invoice_id=inv.id,
                    item_type="time",
                    description=f"Week {row['week']}",
                    hours=float(row["hours"]),
                    rate=float(row["rate"]),
                    amount=float(row["amount"]),
                )
            )
        for row in payload.get("expense_rows", []):
            db.session.add(
                InvoiceLineItem(
                    invoice_id=inv.id,
                    item_type="expense",
                    description=row["description"],
                    hours=0,
                    rate=0,
                    amount=float(row["amount"]),
                )
            )

        time_entry_ids = payload.get("time_entry_ids", [])
        if time_entry_ids:
            TimeEntry.query.filter(TimeEntry.id.in_(time_entry_ids)).update(
                {"invoiced": True, "invoice_id": inv.id}, synchronize_session=False
            )

        expense_ids = [x["id"] for x in payload.get("expense_rows", []) if x.get("id")]
        if expense_ids:
            Expense.query.filter(Expense.id.in_(expense_ids)).update(
                {"invoiced": True, "invoice_id": inv.id}, synchronize_session=False
            )

        db.session.add(InvoiceHistory(invoice_id=inv.id, event="Invoice created"))
        db.session.commit()
        return jsonify(model_to_dict(inv))

    @app.put("/api/invoices/<int:invoice_id>")
    @safe_json
    def invoices_update(invoice_id):
        payload = request.json
        inv = Invoice.query.get_or_404(invoice_id)
        for field in ["invoice_identifier", "po_number", "subject", "notes", "status", "written_off"]:
            if field in payload:
                setattr(inv, field, payload[field])
        if "issue_date" in payload:
            inv.issue_date = parse_date(payload["issue_date"])
        if "due_date" in payload:
            inv.due_date = parse_date(payload["due_date"])
        db.session.add(InvoiceHistory(invoice_id=inv.id, event="Invoice updated"))
        db.session.commit()
        return jsonify(model_to_dict(inv))

    @app.delete("/api/invoices/<int:invoice_id>")
    @safe_json
    def invoices_delete(invoice_id):
        inv = Invoice.query.get_or_404(invoice_id)
        TimeEntry.query.filter_by(invoice_id=invoice_id).update({"invoiced": False, "invoice_id": None})
        Expense.query.filter_by(invoice_id=invoice_id).update({"invoiced": False, "invoice_id": None})
        InvoiceLineItem.query.filter_by(invoice_id=invoice_id).delete()
        InvoiceHistory.query.filter_by(invoice_id=invoice_id).delete()
        db.session.delete(inv)
        db.session.commit()
        return jsonify({"ok": True})

    @app.post("/api/invoices/<int:invoice_id>/write-off")
    @safe_json
    def invoice_writeoff(invoice_id):
        inv = Invoice.query.get_or_404(invoice_id)
        inv.written_off = True
        inv.status = "written_off"
        db.session.add(InvoiceHistory(invoice_id=inv.id, event="Invoice written off"))
        db.session.commit()
        return jsonify(model_to_dict(inv))

    @app.get("/api/invoices/<int:invoice_id>/pdf")
    @safe_json
    def invoice_pdf(invoice_id):
        path = create_pdf_for_invoice(invoice_id)
        return send_file(path, as_attachment=True, download_name=f"invoice-{invoice_id}.pdf")

    @app.post("/api/invoices/<int:invoice_id>/send")
    @safe_json
    def invoice_send(invoice_id):
        inv = Invoice.query.get_or_404(invoice_id)
        client = Client.query.get_or_404(inv.client_id)
        contact = Contact.query.filter_by(client_id=client.id).first()
        if not contact:
            return jsonify({"error": "No client contact available"}), 400

        pdf_path = create_pdf_for_invoice(invoice_id)
        msg = EmailMessage()
        msg["Subject"] = f"Invoice {inv.invoice_identifier}"
        msg["From"] = "billing@localhost"
        msg["To"] = contact.email
        msg.set_content(f"Please find attached invoice {inv.invoice_identifier}.")

        with open(pdf_path, "rb") as f:
            msg.add_attachment(f.read(), maintype="application", subtype="pdf", filename=os.path.basename(pdf_path))

        with smtplib.SMTP(app.config["SMTP_HOST"], app.config["SMTP_PORT"]) as server:
            server.send_message(msg)

        inv.status = "sent"
        db.session.add(InvoiceHistory(invoice_id=inv.id, event=f"Invoice sent to {contact.email}"))
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/reports/invoices")
    def report_invoices():
        client_id = request.args.get("client_id")
        active_only = request.args.get("active_only", "false") == "true"
        q = Invoice.query
        if client_id:
            q = q.filter_by(client_id=client_id)

        rows = []
        for inv in q.all():
            client = Client.query.get(inv.client_id)
            if active_only and client and not client.active:
                continue
            lines = InvoiceLineItem.query.filter_by(invoice_id=inv.id).all()
            hours = sum(l.hours for l in lines if l.item_type == "time")
            rows.append(
                {
                    "invoice_id": inv.invoice_identifier,
                    "client_name": client.name if client else "Unknown",
                    "hours": hours,
                    "amount": invoice_total(inv.id),
                    "issue_date": inv.issue_date.isoformat(),
                }
            )

        sort = request.args.get("sort")
        if sort == "client":
            rows = sorted(rows, key=lambda x: x["client_name"])
        elif sort == "amount":
            rows = sorted(rows, key=lambda x: x["amount"], reverse=True)

        return jsonify(rows)

    @app.get("/api/reports/invoices.csv")
    def report_invoices_csv():
        rows = report_invoices().get_json()
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["invoice_id", "client_name", "hours", "amount", "issue_date"])
        writer.writeheader()
        writer.writerows(rows)
        data = io.BytesIO(output.getvalue().encode("utf-8"))
        return send_file(data, mimetype="text/csv", as_attachment=True, download_name="invoice-report.csv")

    @app.get("/api/reports/ar")
    def report_ar():
        rows = []
        for inv in Invoice.query.filter(Invoice.status.in_(["draft", "sent", "overdue"])).all():
            rows.append(
                {
                    "invoice_id": inv.invoice_identifier,
                    "client_name": Client.query.get(inv.client_id).name,
                    "issue_date": inv.issue_date.isoformat(),
                    "due_date": inv.due_date.isoformat(),
                    "days_overdue": max(0, (date.today() - inv.due_date).days),
                    "amount": invoice_total(inv.id),
                    "status": inv.status,
                }
            )
        return jsonify(rows)

    @app.get("/api/settings")
    def settings_get():
        s = Setting.query.first()
        if not s:
            s = Setting()
            db.session.add(s)
            db.session.commit()
        return jsonify(model_to_dict(s))

    @app.put("/api/settings")
    @safe_json
    def settings_put():
        payload = request.json
        s = Setting.query.first()
        if not s:
            s = Setting()
            db.session.add(s)
        for field in ["company_name", "address", "contact_info", "default_billable_rate"]:
            if field in payload:
                setattr(s, field, payload[field])
        db.session.commit()
        return jsonify(model_to_dict(s))

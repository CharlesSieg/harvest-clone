import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app
from models import db as _db


@pytest.fixture
def app():
    app = create_app()
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['TESTING'] = True
    with app.app_context():
        _db.drop_all()
        _db.create_all()
        from seed import seed_data
        seed_data()
    yield app


@pytest.fixture
def client(app):
    return app.test_client()


class TestSettings:
    def test_get_settings(self, client):
        res = client.get('/api/settings')
        assert res.status_code == 200
        assert res.json['company_name'] == 'My Company'

    def test_update_settings(self, client):
        res = client.put('/api/settings', json={'company_name': 'Test Corp', 'default_billable_rate': 200})
        assert res.status_code == 200
        assert res.json['company_name'] == 'Test Corp'
        assert res.json['default_billable_rate'] == 200.0


class TestClients:
    def test_create_client(self, client):
        res = client.post('/api/clients', json={'name': 'Acme Inc', 'currency': 'USD', 'invoice_due_days': 30})
        assert res.status_code == 201
        assert res.json['name'] == 'Acme Inc'

    def test_list_clients(self, client):
        client.post('/api/clients', json={'name': 'Client A'})
        client.post('/api/clients', json={'name': 'Client B'})
        res = client.get('/api/clients')
        assert res.status_code == 200
        assert len(res.json) == 2

    def test_update_client(self, client):
        res = client.post('/api/clients', json={'name': 'Old Name'})
        cid = res.json['id']
        res = client.put(f'/api/clients/{cid}', json={'name': 'New Name'})
        assert res.json['name'] == 'New Name'

    def test_delete_client(self, client):
        res = client.post('/api/clients', json={'name': 'ToDelete'})
        cid = res.json['id']
        res = client.delete(f'/api/clients/{cid}')
        assert res.status_code == 200


class TestContacts:
    def test_add_contact(self, client):
        res = client.post('/api/clients', json={'name': 'Client'})
        cid = res.json['id']
        res = client.post(f'/api/clients/{cid}/contacts', json={'first_name': 'John', 'last_name': 'Doe', 'email': 'john@test.com'})
        assert res.status_code == 201
        assert res.json['first_name'] == 'John'

    def test_edit_contact(self, client):
        res = client.post('/api/clients', json={'name': 'Client'})
        cid = res.json['id']
        res = client.post(f'/api/clients/{cid}/contacts', json={'first_name': 'Jane'})
        contact_id = res.json['id']
        res = client.put(f'/api/contacts/{contact_id}', json={'first_name': 'Janet'})
        assert res.json['first_name'] == 'Janet'

    def test_delete_contact(self, client):
        res = client.post('/api/clients', json={'name': 'Client'})
        cid = res.json['id']
        res = client.post(f'/api/clients/{cid}/contacts', json={'first_name': 'Del'})
        contact_id = res.json['id']
        res = client.delete(f'/api/contacts/{contact_id}')
        assert res.status_code == 200


class TestTasks:
    def test_create_task(self, client):
        res = client.post('/api/tasks', json={'name': 'Development', 'billable_rate': 150})
        assert res.status_code == 201
        assert res.json['name'] == 'Development'

    def test_archive_task(self, client):
        res = client.post('/api/tasks', json={'name': 'Task1', 'billable_rate': 100})
        tid = res.json['id']
        res = client.put(f'/api/tasks/{tid}/archive')
        assert res.json['archived'] is True

    def test_delete_task_no_time(self, client):
        res = client.post('/api/tasks', json={'name': 'Temp'})
        tid = res.json['id']
        res = client.delete(f'/api/tasks/{tid}')
        assert res.status_code == 200


class TestExpenseCategories:
    def test_list_seeded_categories(self, client):
        res = client.get('/api/expense-categories')
        assert res.status_code == 200
        names = [c['name'] for c in res.json]
        assert 'Entertainment' in names
        assert 'Meals' in names

    def test_create_category(self, client):
        res = client.post('/api/expense-categories', json={'name': 'New Cat'})
        assert res.status_code == 201

    def test_archive_category(self, client):
        res = client.post('/api/expense-categories', json={'name': 'ArchCat'})
        cid = res.json['id']
        res = client.put(f'/api/expense-categories/{cid}/archive')
        assert res.json['archived'] is True


class TestProjects:
    def _setup(self, client):
        res = client.post('/api/clients', json={'name': 'Client'})
        cid = res.json['id']
        res = client.post('/api/tasks', json={'name': 'Dev', 'billable_rate': 150})
        tid = res.json['id']
        return cid, tid

    def test_create_project(self, client):
        cid, tid = self._setup(client)
        res = client.post('/api/projects', json={'client_id': cid, 'name': 'Project A', 'task_ids': [tid]})
        assert res.status_code == 201
        assert res.json['name'] == 'Project A'
        assert len(res.json['tasks']) == 1

    def test_archive_project(self, client):
        cid, tid = self._setup(client)
        res = client.post('/api/projects', json={'client_id': cid, 'name': 'Proj'})
        pid = res.json['id']
        res = client.put(f'/api/projects/{pid}/archive')
        assert res.json['archived'] is True

    def test_duplicate_project(self, client):
        cid, tid = self._setup(client)
        res = client.post('/api/projects', json={'client_id': cid, 'name': 'Orig', 'task_ids': [tid]})
        pid = res.json['id']
        res = client.post(f'/api/projects/{pid}/duplicate')
        assert res.status_code == 201
        assert 'Copy' in res.json['name']

    def test_delete_project_no_time(self, client):
        cid, tid = self._setup(client)
        res = client.post('/api/projects', json={'client_id': cid, 'name': 'Del'})
        pid = res.json['id']
        res = client.delete(f'/api/projects/{pid}')
        assert res.status_code == 200


class TestTimeEntries:
    def _setup(self, client):
        res = client.post('/api/clients', json={'name': 'Client'})
        cid = res.json['id']
        res = client.post('/api/tasks', json={'name': 'Dev', 'billable_rate': 150})
        tid = res.json['id']
        res = client.post('/api/projects', json={'client_id': cid, 'name': 'Proj', 'task_ids': [tid]})
        pid = res.json['id']
        return cid, tid, pid

    def test_create_time_entry(self, client):
        cid, tid, pid = self._setup(client)
        res = client.post('/api/time-entries', json={'date': '2025-01-15', 'hours': 8, 'project_id': pid, 'task_id': tid})
        assert res.status_code == 201
        assert res.json['hours'] == 8

    def test_list_time_entries(self, client):
        cid, tid, pid = self._setup(client)
        client.post('/api/time-entries', json={'date': '2025-01-15', 'hours': 8, 'project_id': pid, 'task_id': tid})
        res = client.get('/api/time-entries?start_date=2025-01-01&end_date=2025-01-31')
        assert len(res.json) == 1

    def test_fill_month(self, client):
        cid, tid, pid = self._setup(client)
        res = client.post('/api/time-entries/fill-month', json={
            'year': 2025, 'month': 1, 'hours': 8, 'project_id': pid, 'task_id': tid
        })
        assert res.status_code == 201
        # January 2025 has 23 weekdays
        assert len(res.json) == 23

    def test_delete_prevents_project_delete(self, client):
        cid, tid, pid = self._setup(client)
        client.post('/api/time-entries', json={'date': '2025-01-15', 'hours': 8, 'project_id': pid, 'task_id': tid})
        res = client.delete(f'/api/projects/{pid}')
        assert res.status_code == 400


class TestExpenses:
    def _setup(self, client):
        res = client.post('/api/clients', json={'name': 'Client'})
        cid = res.json['id']
        res = client.post('/api/projects', json={'client_id': cid, 'name': 'Proj'})
        pid = res.json['id']
        cats = client.get('/api/expense-categories').json
        cat_id = cats[0]['id']
        return pid, cat_id

    def test_create_expense(self, client):
        pid, cat_id = self._setup(client)
        res = client.post('/api/expenses', json={
            'date': '2025-01-15', 'project_id': pid, 'category_id': cat_id, 'amount': 50.00, 'notes': 'Lunch'
        })
        assert res.status_code == 201
        assert res.json['amount'] == 50.0


class TestInvoices:
    def _setup(self, client):
        res = client.post('/api/clients', json={'name': 'Client', 'invoice_due_days': 30})
        cid = res.json['id']
        res = client.post('/api/tasks', json={'name': 'Dev', 'billable_rate': 150})
        tid = res.json['id']
        res = client.post('/api/projects', json={'client_id': cid, 'name': 'Proj', 'task_ids': [tid]})
        pid = res.json['id']
        res = client.post('/api/time-entries', json={'date': '2025-01-15', 'hours': 8, 'project_id': pid, 'task_id': tid})
        te_id = res.json['id']
        return cid, tid, pid, te_id

    def test_create_invoice(self, client):
        cid, tid, pid, te_id = self._setup(client)
        res = client.post('/api/invoices', json={
            'client_id': cid,
            'invoice_number': 'INV-001',
            'issue_date': '2025-02-01',
            'due_date': '2025-03-01',
            'time_entry_ids': [te_id],
            'expense_ids': [],
        })
        assert res.status_code == 201
        assert res.json['invoice_number'] == 'INV-001'
        assert res.json['total_amount'] == 1200.0  # 8 hours * $150

    def test_invoice_pdf(self, client):
        cid, tid, pid, te_id = self._setup(client)
        res = client.post('/api/invoices', json={
            'client_id': cid,
            'invoice_number': 'INV-002',
            'issue_date': '2025-02-01',
            'due_date': '2025-03-01',
            'time_entry_ids': [te_id],
            'expense_ids': [],
        })
        inv_id = res.json['id']
        res = client.get(f'/api/invoices/{inv_id}/pdf')
        assert res.status_code == 200
        assert res.content_type == 'application/pdf'

    def test_delete_invoice_unmarks_entries(self, client):
        cid, tid, pid, te_id = self._setup(client)
        res = client.post('/api/invoices', json={
            'client_id': cid,
            'invoice_number': 'INV-003',
            'issue_date': '2025-02-01',
            'due_date': '2025-03-01',
            'time_entry_ids': [te_id],
            'expense_ids': [],
        })
        inv_id = res.json['id']
        client.delete(f'/api/invoices/{inv_id}')
        # Time entry should be uninvoiced again
        res = client.get('/api/time-entries?start_date=2025-01-01&end_date=2025-12-31')
        assert res.json[0]['invoice_id'] is None


class TestReports:
    def test_accounts_receivable_empty(self, client):
        res = client.get('/api/reports/accounts-receivable')
        assert res.status_code == 200
        assert res.json == []

    def test_invoices_report_empty(self, client):
        res = client.get('/api/reports/invoices')
        assert res.status_code == 200
        assert res.json == []

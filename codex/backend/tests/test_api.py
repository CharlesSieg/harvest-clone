import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["UPLOAD_FOLDER"] = "/tmp/uploads-test"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app  # noqa: E402


def test_bootstrap_and_seed_categories():
    app = create_app()
    client = app.test_client()
    r = client.get("/api/bootstrap")
    assert r.status_code == 200
    data = r.get_json()
    names = {x["name"] for x in data["categories"]}
    assert {"Meals", "Lodging", "Other"}.issubset(names)


def test_project_delete_blocked_by_time_entries():
    app = create_app()
    c = app.test_client()
    client_id = c.post("/api/clients", json={"name": "Acme"}).get_json()["id"]
    task_id = c.post("/api/tasks", json={"name": "Dev", "billable_rate": 150}).get_json()["id"]
    project_id = c.post("/api/projects", json={"client_id": client_id, "name": "Website", "task_ids": [task_id]}).get_json()["id"]
    c.post("/api/time-entries", json={"project_id": project_id, "task_id": task_id, "entry_date": "2026-01-05", "hours": 2})

    blocked = c.delete(f"/api/projects/{project_id}")
    assert blocked.status_code == 400
    assert "Cannot delete project" in blocked.get_json()["error"]

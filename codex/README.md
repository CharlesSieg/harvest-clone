# Consultant Time & Expense Tracker

Full-stack application built from `draft-requirements.md`.

## Stack
- Frontend: React + Vite
- Backend: Flask + SQLAlchemy
- Database: PostgreSQL
- Email testing: MailHog
- PDF generation: ReportLab

## Run with Docker Compose
```bash
docker compose up --build -d
```

URLs:
- Frontend: http://localhost:3030
- Backend API: http://localhost:3031
- MailHog UI (for sent invoices): http://localhost:3032
- MailHog SMTP: localhost:3033

## Tests
Backend unit tests:
```bash
docker compose run --rm backend pytest -q
```

Frontend unit tests:
```bash
docker compose run --rm frontend npm test
```

Playwright smoke test (using official Playwright image on compose network):
```bash
docker run --rm --network codex_default -v "$(pwd)/frontend:/work" -w /work mcr.microsoft.com/playwright:v1.49.1-jammy bash -lc "npx playwright test --config=playwright.compose.config.js"
```

## Implemented Features
- Top navigation: Time, Expenses, Projects, Reports, Invoices, Manage, Settings
- Time entry by day and week summary table
- Bulk weekday fill for a month per task/project
- Expenses with project/category/date/notes/amount + file attachment
- Projects list with status/client filters and actions (edit, duplicate, archive, delete with guard)
- Invoices list and creation flow with uninvoiced time/expense preview
- Invoice detail view with history, PDF generation, send by email, write-off, delete
- Reports: Invoice report (sortable/filterable + CSV export) and Accounts Receivable report
- Manage: Clients + contacts, Tasks, Expense Categories
- Settings: company profile and default billable rate
- Seed expense categories: Entertainment, Meals, Lodging, Mileage, Transportation, Other

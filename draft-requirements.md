# Overview

This application is intended for a consultant to track billable time and expenses to client projects by task.

# Tech Stack

This will be a web application using React for the frontend and Python with Flask for the backend. Postgres will be the database.

# Authentication

This application is a single-user application. Authentication will be done external to the application by certificate. There is no need to track a user, user ID, etc.

# Navigation

The main navigation bar at the top of the page has the following items: Time, Expenses, Projects, Reports, Invoice, Manage, and Settings.

## Time

The Time page allows time entry by day and by week. There can be multiple entries per day and each entry should be associated with a project and a task. Looking at a Week view would show a list of tasks and boxes for entering the time per task for a given day. I also want a button which will allow me to enter a given number of hours for every *weekday* of a given month for a task.

## Expenses

The Expenses page lists expenses incurred to a particular project. The application should allow an expense to be entered including the date, the project (which implies the client), an expense category, notes, and the amount of the expense. I would like to be able to also attach a file, usually a PDF, to the expense, i.e. a scanned receipt.

## Projects

The Projects page lists projects. The list can show All, Active, or Archived projects. Projects are grouped by clients and each project has an Actions button which allows a project to be edited, duplicated, archived, or deleted. Projects can only be deleted if there is no time recorded to it. The project list can also be filtered by client. When creating a new project, the following information can be provided:

Client
Project name
Project code - optional
Dates (start and end) - optional
Notes
Tasks - one or more tasks (from the list of Tasks on the Manage page)

## Invoices

The Invoices page shows a list of all outstanding invoices and a button for creating a new invoice.

Creating an invoice involves first selecting a client then choosing the projects to include on the invoice. Then the selection of hours: All uninvoiced hours or uninvoiced hours for a particular time period (Current Month, Last Month, Custom). Also, any uninvoiced expenses are listed and, if selected, to be included on the invoice as a line item. After making these selection, allow the entry of an invoice ID, PO number, Issue Date, Due Date (default to client value), the subject of the invoices, and notes. The invoice should show line items for time for each week, the hours for the week, the billable rate, and the total amount for the line item. Expenses are separate line items. The bottom of the invoice should show the total amount due.

The invoice list should show the invoice status, "due in X days", date issued, ID, client name, and amount of the invoice. The invoice list can be filtered by client, date range, and show all invoices or only invoices with a selected status.

Clicking on an invoice shows all of the invoice detail and line items, as well as the invoice history, i.e. when the invoice was created, updated, marked as sent, etc. The invoice should be formatted on screen similar to how it would be formally printed. The invoice can be edited, deleted, or written off. A Send button will allow the PDF to be sent automatically by email to a client contact. A PDF button allows the invoice to be generated as a PDF and saved locally.

## Reports

The Reports page has subnavigation for several specific reports:

Invoices - This report shows all invoices in the system. It can be filtered by client, date range, etc. and optionally include only active clients. The invoice list should show client name, total hours on the invoice, and the amount of the invoice. The list can be sorted by client name and invoice amount. There should be an Export button which allows the report to be exported in CSV format.

Accounts Receivable - This report should be a standard AR report showing all outstanding invoices per usual.

## Manage

The Manage page has subnavigation for Clients, Expense Categories, and Tasks.

The Clients page lists the current clients. A New Client button shows a modal which allows the client name, address, preferred currency, default invoice due date (Upon receipt, Net 15, Net 30, Net 45, Net 60, and Custom). I think tracking due date by number of days is probably the way to model that. Clients can be edited (all values). One or more Contacts can be added per client (Add contact button). Contacts appear under their respective client in the client list and can be edited and deleted. Adding a contact allows the first and last name of the contact to be entered, their email, title, office phone number, mobile number, and FAX number.

The Tasks page lists the current tasks. Tasks belong to Projects and are what time is recorded against. A task has a name and a billable rate. Tasks can be edited, archived, and deleted (only if no time put against it).

The Expense Categories page lists the current expense categories. A New Category button shows a modal which allows the name of the category to be entered. The name of an existing category can be edited. An expense category can be archived (Archive button). Archived categories no longer appear when entering an expense. Expense categories can also be deleted but only if there are no expenses associated with the category.

## Settings

The Settings page captures the company name, address, contact info, and default billable rate.

# Seed Data

Expense Categories should be prepopulated with Entertainment, Meals, Lodging, Mileage, Transportation, and Other.
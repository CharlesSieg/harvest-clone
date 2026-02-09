import { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3031'

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, options)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Request failed: ${res.status}`)
  }
  return res
}

function money(n) {
  return Number(n || 0).toFixed(2)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const NAV = ['Time', 'Expenses', 'Projects', 'Reports', 'Invoices', 'Manage', 'Settings']

export default function App() {
  const [nav, setNav] = useState('Time')
  const [manageTab, setManageTab] = useState('Clients')
  const [reportsTab, setReportsTab] = useState('Invoices')
  const [data, setData] = useState({ clients: [], contacts: [], projects: [], tasks: [], project_tasks: [], categories: [], settings: {} })
  const [timeEntries, setTimeEntries] = useState([])
  const [expenses, setExpenses] = useState([])
  const [invoices, setInvoices] = useState([])
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [message, setMessage] = useState('')

  const [timeForm, setTimeForm] = useState({ project_id: '', task_id: '', entry_date: todayISO(), hours: 1 })
  const [bulkForm, setBulkForm] = useState({ project_id: '', task_id: '', year: new Date().getFullYear(), month: new Date().getMonth() + 1, hours: 8 })

  const [expenseForm, setExpenseForm] = useState({ expense_date: todayISO(), project_id: '', category_id: '', notes: '', amount: '', attachment: null })

  const [projectFilter, setProjectFilter] = useState({ status: 'all', client_id: '' })
  const [projectForm, setProjectForm] = useState({ client_id: '', name: '', code: '', start_date: '', end_date: '', notes: '', task_ids: [] })

  const [clientForm, setClientForm] = useState({ name: '', address: '', currency: 'USD', due_days: 30, active: true })
  const [contactForm, setContactForm] = useState({ client_id: '', first_name: '', last_name: '', email: '', title: '', office_phone: '', mobile_phone: '', fax: '' })
  const [taskForm, setTaskForm] = useState({ name: '', billable_rate: 100 })
  const [categoryForm, setCategoryForm] = useState({ name: '' })

  const [invoiceFilter, setInvoiceFilter] = useState({ client_id: '', status: 'all', start_date: '', end_date: '' })
  const [invoiceWizard, setInvoiceWizard] = useState({
    client_id: '',
    project_ids: [],
    hours_mode: 'all',
    start_date: '',
    end_date: '',
    include_expenses: true,
    invoice_identifier: '',
    po_number: '',
    issue_date: todayISO(),
    due_date: todayISO(),
    subject: '',
    notes: ''
  })
  const [invoicePreview, setInvoicePreview] = useState({ time_rows: [], expense_rows: [], total: 0, time_entry_ids: [] })

  const [reportFilter, setReportFilter] = useState({ client_id: '', sort: '', active_only: false })
  const [invoiceReport, setInvoiceReport] = useState([])
  const [arReport, setArReport] = useState([])

  async function refreshBootstrap() {
    const r = await api('/api/bootstrap')
    setData(await r.json())
  }

  async function refreshTime() {
    const r = await api('/api/time-entries')
    setTimeEntries(await r.json())
  }

  async function refreshExpenses() {
    const r = await api('/api/expenses')
    setExpenses(await r.json())
  }

  async function refreshInvoices() {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(invoiceFilter)) {
      if (v) params.set(k, v)
    }
    const r = await api(`/api/invoices?${params.toString()}`)
    setInvoices(await r.json())
  }

  async function refreshReports() {
    const params = new URLSearchParams()
    if (reportFilter.client_id) params.set('client_id', reportFilter.client_id)
    if (reportFilter.sort) params.set('sort', reportFilter.sort)
    if (reportFilter.active_only) params.set('active_only', 'true')
    const [inv, ar] = await Promise.all([
      api(`/api/reports/invoices?${params.toString()}`).then((r) => r.json()),
      api('/api/reports/ar').then((r) => r.json())
    ])
    setInvoiceReport(inv)
    setArReport(ar)
  }

  async function refreshAll() {
    await Promise.all([refreshBootstrap(), refreshTime(), refreshExpenses(), refreshInvoices(), refreshReports()])
  }

  useEffect(() => {
    refreshAll().catch((e) => setMessage(e.message))
  }, [])

  useEffect(() => {
    refreshInvoices().catch((e) => setMessage(e.message))
  }, [invoiceFilter])

  useEffect(() => {
    refreshReports().catch((e) => setMessage(e.message))
  }, [reportFilter])

  const tasksByProject = useMemo(() => {
    const map = {}
    for (const pt of data.project_tasks) {
      map[pt.project_id] ||= []
      map[pt.project_id].push(pt.task_id)
    }
    return map
  }, [data.project_tasks])

  const weekRows = useMemo(() => {
    const grouped = {}
    for (const e of timeEntries) {
      const dt = new Date(e.entry_date)
      const monday = new Date(dt)
      const day = dt.getDay()
      const offset = (day + 6) % 7
      monday.setDate(dt.getDate() - offset)
      const week = monday.toISOString().slice(0, 10)
      const key = `${e.project_id}-${e.task_id}`
      grouped[key] ||= { project_id: e.project_id, task_id: e.task_id, days: {}, total: 0 }
      const d = new Date(e.entry_date).toLocaleDateString('en-US', { weekday: 'short' })
      grouped[key].week = week
      grouped[key].days[d] = (grouped[key].days[d] || 0) + e.hours
      grouped[key].total += e.hours
    }
    return Object.values(grouped)
  }, [timeEntries])

  async function submitJSON(path, method, body, after) {
    try {
      await api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      setMessage('Saved')
      if (after) await after()
    } catch (e) {
      setMessage(e.message)
    }
  }

  async function createTime(e) {
    e.preventDefault()
    await submitJSON('/api/time-entries', 'POST', { ...timeForm, hours: Number(timeForm.hours) }, refreshTime)
  }

  async function bulkTime(e) {
    e.preventDefault()
    await submitJSON('/api/time-entries/month-weekdays', 'POST', { ...bulkForm, hours: Number(bulkForm.hours) }, refreshTime)
  }

  async function createExpense(e) {
    e.preventDefault()
    try {
      const fd = new FormData()
      Object.entries(expenseForm).forEach(([k, v]) => {
        if (v !== null && v !== '') fd.append(k, v)
      })
      await api('/api/expenses', { method: 'POST', body: fd })
      setMessage('Expense added')
      setExpenseForm({ expense_date: todayISO(), project_id: '', category_id: '', notes: '', amount: '', attachment: null })
      await refreshExpenses()
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function createProject(e) {
    e.preventDefault()
    await submitJSON('/api/projects', 'POST', { ...projectForm, client_id: Number(projectForm.client_id), task_ids: projectForm.task_ids.map(Number) }, refreshBootstrap)
  }

  async function saveSettings(e) {
    e.preventDefault()
    await submitJSON('/api/settings', 'PUT', data.settings, refreshBootstrap)
  }

  async function createClient(e) {
    e.preventDefault()
    await submitJSON('/api/clients', 'POST', clientForm, refreshBootstrap)
    setClientForm({ name: '', address: '', currency: 'USD', due_days: 30, active: true })
  }

  async function createContact(e) {
    e.preventDefault()
    await submitJSON(`/api/clients/${contactForm.client_id}/contacts`, 'POST', contactForm, refreshBootstrap)
    setContactForm({ client_id: '', first_name: '', last_name: '', email: '', title: '', office_phone: '', mobile_phone: '', fax: '' })
  }

  async function createTask(e) {
    e.preventDefault()
    await submitJSON('/api/tasks', 'POST', taskForm, refreshBootstrap)
    setTaskForm({ name: '', billable_rate: 100 })
  }

  async function createCategory(e) {
    e.preventDefault()
    await submitJSON('/api/expense-categories', 'POST', categoryForm, refreshBootstrap)
    setCategoryForm({ name: '' })
  }

  async function projectAction(id, action) {
    try {
      if (action === 'duplicate') await api(`/api/projects/${id}/duplicate`, { method: 'POST' })
      if (action === 'archive') await api(`/api/projects/${id}/archive`, { method: 'POST' })
      if (action === 'delete') await api(`/api/projects/${id}`, { method: 'DELETE' })
      setMessage(`Project ${action}d`)
      await refreshBootstrap()
    } catch (e) {
      setMessage(e.message)
    }
  }

  async function loadInvoicePreview() {
    try {
      const res = await api('/api/invoices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...invoiceWizard,
          client_id: Number(invoiceWizard.client_id),
          project_ids: invoiceWizard.project_ids.map(Number)
        })
      })
      setInvoicePreview(await res.json())
    } catch (e) {
      setMessage(e.message)
    }
  }

  async function createInvoice() {
    try {
      await api('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...invoiceWizard,
          client_id: Number(invoiceWizard.client_id),
          project_ids: invoiceWizard.project_ids.map(Number),
          time_rows: invoicePreview.time_rows,
          expense_rows: invoicePreview.expense_rows,
          time_entry_ids: invoicePreview.time_entry_ids
        })
      })
      setMessage('Invoice created')
      setInvoicePreview({ time_rows: [], expense_rows: [], total: 0, time_entry_ids: [] })
      await refreshInvoices()
      await refreshTime()
      await refreshExpenses()
    } catch (e) {
      setMessage(e.message)
    }
  }

  async function openInvoice(id) {
    try {
      const r = await api(`/api/invoices/${id}`)
      setInvoiceDetail(await r.json())
    } catch (e) {
      setMessage(e.message)
    }
  }

  async function invoiceAction(id, action) {
    try {
      if (action === 'send') await api(`/api/invoices/${id}/send`, { method: 'POST' })
      if (action === 'writeoff') await api(`/api/invoices/${id}/write-off`, { method: 'POST' })
      if (action === 'delete') await api(`/api/invoices/${id}`, { method: 'DELETE' })
      if (action === 'pdf') window.open(`${API}/api/invoices/${id}/pdf`, '_blank')
      await refreshInvoices()
      if (invoiceDetail?.id === id) await openInvoice(id)
      setMessage(`Invoice ${action} completed`)
    } catch (e) {
      setMessage(e.message)
    }
  }

  async function exportCSV() {
    window.open(`${API}/api/reports/invoices.csv`, '_blank')
  }

  const visibleProjects = data.projects.filter((p) => {
    if (projectFilter.status === 'active' && p.archived) return false
    if (projectFilter.status === 'archived' && !p.archived) return false
    if (projectFilter.client_id && Number(projectFilter.client_id) !== p.client_id) return false
    return true
  })

  return (
    <div className="shell">
      <header>
        <h1>Consulting Tracker</h1>
        <nav>
          {NAV.map((n) => (
            <button key={n} className={nav === n ? 'active' : ''} onClick={() => setNav(n)}>{n}</button>
          ))}
        </nav>
      </header>

      {message && <p className="message">{message}</p>}

      {nav === 'Time' && (
        <section>
          <h2>Time Entry</h2>
          <form onSubmit={createTime} className="grid-form">
            <select value={timeForm.project_id} onChange={(e) => setTimeForm({ ...timeForm, project_id: e.target.value, task_id: '' })} required>
              <option value="">Project</option>
              {data.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={timeForm.task_id} onChange={(e) => setTimeForm({ ...timeForm, task_id: e.target.value })} required>
              <option value="">Task</option>
              {(tasksByProject[Number(timeForm.project_id)] || []).map((id) => {
                const t = data.tasks.find((x) => x.id === id)
                return <option key={id} value={id}>{t?.name}</option>
              })}
            </select>
            <input type="date" value={timeForm.entry_date} onChange={(e) => setTimeForm({ ...timeForm, entry_date: e.target.value })} required />
            <input type="number" step="0.25" value={timeForm.hours} onChange={(e) => setTimeForm({ ...timeForm, hours: e.target.value })} required />
            <button type="submit">Add Time</button>
          </form>

          <h3>Fill Weekdays for Month</h3>
          <form onSubmit={bulkTime} className="grid-form">
            <select value={bulkForm.project_id} onChange={(e) => setBulkForm({ ...bulkForm, project_id: e.target.value, task_id: '' })} required>
              <option value="">Project</option>
              {data.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={bulkForm.task_id} onChange={(e) => setBulkForm({ ...bulkForm, task_id: e.target.value })} required>
              <option value="">Task</option>
              {(tasksByProject[Number(bulkForm.project_id)] || []).map((id) => {
                const t = data.tasks.find((x) => x.id === id)
                return <option key={id} value={id}>{t?.name}</option>
              })}
            </select>
            <input type="number" value={bulkForm.year} onChange={(e) => setBulkForm({ ...bulkForm, year: e.target.value })} required />
            <input type="number" min="1" max="12" value={bulkForm.month} onChange={(e) => setBulkForm({ ...bulkForm, month: e.target.value })} required />
            <input type="number" step="0.25" value={bulkForm.hours} onChange={(e) => setBulkForm({ ...bulkForm, hours: e.target.value })} required />
            <button type="submit">Fill Month Weekdays</button>
          </form>

          <h3>Week View</h3>
          <table>
            <thead>
              <tr><th>Week</th><th>Project</th><th>Task</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Total</th></tr>
            </thead>
            <tbody>
              {weekRows.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.week}</td>
                  <td>{data.projects.find((p) => p.id === row.project_id)?.name}</td>
                  <td>{data.tasks.find((t) => t.id === row.task_id)?.name}</td>
                  <td>{row.days.Mon || 0}</td>
                  <td>{row.days.Tue || 0}</td>
                  <td>{row.days.Wed || 0}</td>
                  <td>{row.days.Thu || 0}</td>
                  <td>{row.days.Fri || 0}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {nav === 'Expenses' && (
        <section>
          <h2>Expenses</h2>
          <form onSubmit={createExpense} className="grid-form">
            <input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} required />
            <select value={expenseForm.project_id} onChange={(e) => setExpenseForm({ ...expenseForm, project_id: e.target.value })} required>
              <option value="">Project</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={expenseForm.category_id} onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })} required>
              <option value="">Category</option>
              {data.categories.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Amount" type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
            <input placeholder="Notes" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
            <input type="file" onChange={(e) => setExpenseForm({ ...expenseForm, attachment: e.target.files[0] || null })} />
            <button type="submit">Add Expense</button>
          </form>

          <table>
            <thead><tr><th>Date</th><th>Project</th><th>Category</th><th>Notes</th><th>Amount</th><th>Receipt</th></tr></thead>
            <tbody>
              {expenses.map((x) => (
                <tr key={x.id}>
                  <td>{x.expense_date}</td>
                  <td>{data.projects.find((p) => p.id === x.project_id)?.name}</td>
                  <td>{data.categories.find((c) => c.id === x.category_id)?.name}</td>
                  <td>{x.notes}</td>
                  <td>{money(x.amount)}</td>
                  <td>{x.attachment ? <a href={`${API}/api/expenses/${x.id}/attachment`} target="_blank">PDF</a> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {nav === 'Projects' && (
        <section>
          <h2>Projects</h2>
          <div className="filters">
            <select value={projectFilter.status} onChange={(e) => setProjectFilter({ ...projectFilter, status: e.target.value })}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <select value={projectFilter.client_id} onChange={(e) => setProjectFilter({ ...projectFilter, client_id: e.target.value })}>
              <option value="">All Clients</option>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <form onSubmit={createProject} className="grid-form">
            <select value={projectForm.client_id} onChange={(e) => setProjectForm({ ...projectForm, client_id: e.target.value })} required>
              <option value="">Client</option>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Project Name" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} required />
            <input placeholder="Project Code" value={projectForm.code} onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })} />
            <input type="date" value={projectForm.start_date} onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })} />
            <input type="date" value={projectForm.end_date} onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })} />
            <input placeholder="Notes" value={projectForm.notes} onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })} />
            <select multiple value={projectForm.task_ids} onChange={(e) => setProjectForm({ ...projectForm, task_ids: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
              {data.tasks.filter((t) => !t.archived).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="submit">Create Project</button>
          </form>

          <table>
            <thead><tr><th>Client</th><th>Name</th><th>Code</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleProjects.map((p) => (
                <tr key={p.id}>
                  <td>{data.clients.find((c) => c.id === p.client_id)?.name}</td>
                  <td>{p.name}</td>
                  <td>{p.code}</td>
                  <td>{p.archived ? 'Archived' : 'Active'}</td>
                  <td className="actions">
                    <button onClick={() => submitJSON(`/api/projects/${p.id}`, 'PUT', { ...p, name: `${p.name} (Edited)` }, refreshBootstrap)}>Edit</button>
                    <button onClick={() => projectAction(p.id, 'duplicate')}>Duplicate</button>
                    <button onClick={() => projectAction(p.id, 'archive')}>Archive</button>
                    <button onClick={() => projectAction(p.id, 'delete')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {nav === 'Invoices' && (
        <section>
          <h2>Invoices</h2>
          <div className="grid-form">
            <select value={invoiceFilter.client_id} onChange={(e) => setInvoiceFilter({ ...invoiceFilter, client_id: e.target.value })}>
              <option value="">All Clients</option>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={invoiceFilter.status} onChange={(e) => setInvoiceFilter({ ...invoiceFilter, status: e.target.value })}>
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="written_off">Written Off</option>
            </select>
            <input type="date" value={invoiceFilter.start_date} onChange={(e) => setInvoiceFilter({ ...invoiceFilter, start_date: e.target.value })} />
            <input type="date" value={invoiceFilter.end_date} onChange={(e) => setInvoiceFilter({ ...invoiceFilter, end_date: e.target.value })} />
          </div>

          <h3>Create Invoice</h3>
          <div className="grid-form">
            <select value={invoiceWizard.client_id} onChange={(e) => {
              const c = data.clients.find((x) => x.id === Number(e.target.value))
              const due = new Date()
              due.setDate(due.getDate() + Number(c?.due_days || 30))
              setInvoiceWizard({ ...invoiceWizard, client_id: e.target.value, due_date: due.toISOString().slice(0, 10) })
            }}>
              <option value="">Client</option>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select multiple value={invoiceWizard.project_ids} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, project_ids: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
              {data.projects.filter((p) => !invoiceWizard.client_id || p.client_id === Number(invoiceWizard.client_id)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select value={invoiceWizard.hours_mode} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, hours_mode: e.target.value })}>
              <option value="all">All Uninvoiced Hours</option>
              <option value="current_month">Current Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom</option>
            </select>
            {invoiceWizard.hours_mode === 'custom' && (
              <>
                <input type="date" value={invoiceWizard.start_date} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, start_date: e.target.value })} />
                <input type="date" value={invoiceWizard.end_date} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, end_date: e.target.value })} />
              </>
            )}
            <label><input type="checkbox" checked={invoiceWizard.include_expenses} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, include_expenses: e.target.checked })} /> Include Uninvoiced Expenses</label>
            <button onClick={loadInvoicePreview}>Preview Invoice</button>
            <input placeholder="Invoice ID" value={invoiceWizard.invoice_identifier} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, invoice_identifier: e.target.value })} />
            <input placeholder="PO Number" value={invoiceWizard.po_number} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, po_number: e.target.value })} />
            <input type="date" value={invoiceWizard.issue_date} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, issue_date: e.target.value })} />
            <input type="date" value={invoiceWizard.due_date} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, due_date: e.target.value })} />
            <input placeholder="Subject" value={invoiceWizard.subject} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, subject: e.target.value })} />
            <input placeholder="Notes" value={invoiceWizard.notes} onChange={(e) => setInvoiceWizard({ ...invoiceWizard, notes: e.target.value })} />
            <button onClick={createInvoice}>Create Invoice</button>
          </div>

          <div className="invoice-preview">
            <h4>Preview Total: {money(invoicePreview.total)}</h4>
            {invoicePreview.time_rows.map((r, i) => <div key={i}>Week {r.week}: {r.hours}h @ {money(r.rate)} = {money(r.amount)}</div>)}
            {invoicePreview.expense_rows.map((r, i) => <div key={i}>Expense: {r.description} = {money(r.amount)}</div>)}
          </div>

          <table>
            <thead><tr><th>Status</th><th>Due In</th><th>Date Issued</th><th>ID</th><th>Client</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.status}</td>
                  <td>{inv.due_in_days} days</td>
                  <td>{inv.issue_date}</td>
                  <td><button onClick={() => openInvoice(inv.id)}>{inv.invoice_identifier}</button></td>
                  <td>{inv.client_name}</td>
                  <td>{money(inv.amount)}</td>
                  <td className="actions">
                    <button onClick={() => invoiceAction(inv.id, 'send')}>Send</button>
                    <button onClick={() => invoiceAction(inv.id, 'pdf')}>PDF</button>
                    <button onClick={() => invoiceAction(inv.id, 'writeoff')}>Write Off</button>
                    <button onClick={() => invoiceAction(inv.id, 'delete')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {invoiceDetail && (
            <div className="invoice-card">
              <h3>Invoice {invoiceDetail.invoice_identifier}</h3>
              <p>Issue: {invoiceDetail.issue_date} | Due: {invoiceDetail.due_date} | Status: {invoiceDetail.status}</p>
              <p>{invoiceDetail.subject}</p>
              <table>
                <thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>
                  {invoiceDetail.line_items.map((l) => <tr key={l.id}><td>{l.description}</td><td>{l.hours || '-'}</td><td>{l.rate || '-'}</td><td>{money(l.amount)}</td></tr>)}
                </tbody>
              </table>
              <p><strong>Total Due: {money(invoiceDetail.total)}</strong></p>
              <h4>History</h4>
              {invoiceDetail.history.map((h) => <div key={h.id}>{h.created_at}: {h.event}</div>)}
            </div>
          )}
        </section>
      )}

      {nav === 'Reports' && (
        <section>
          <h2>Reports</h2>
          <div className="subnav">
            {['Invoices', 'Accounts Receivable'].map((x) => <button key={x} className={reportsTab === x ? 'active' : ''} onClick={() => setReportsTab(x)}>{x}</button>)}
          </div>

          {reportsTab === 'Invoices' && (
            <>
              <div className="filters">
                <select value={reportFilter.client_id} onChange={(e) => setReportFilter({ ...reportFilter, client_id: e.target.value })}>
                  <option value="">All Clients</option>
                  {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={reportFilter.sort} onChange={(e) => setReportFilter({ ...reportFilter, sort: e.target.value })}>
                  <option value="">No Sort</option>
                  <option value="client">Sort Client</option>
                  <option value="amount">Sort Amount</option>
                </select>
                <label><input type="checkbox" checked={reportFilter.active_only} onChange={(e) => setReportFilter({ ...reportFilter, active_only: e.target.checked })} /> Active Clients Only</label>
                <button onClick={exportCSV}>Export CSV</button>
              </div>
              <table>
                <thead><tr><th>Client</th><th>Hours</th><th>Amount</th><th>Invoice</th><th>Date</th></tr></thead>
                <tbody>
                  {invoiceReport.map((r) => <tr key={`${r.invoice_id}-${r.client_name}`}><td>{r.client_name}</td><td>{r.hours}</td><td>{money(r.amount)}</td><td>{r.invoice_id}</td><td>{r.issue_date}</td></tr>)}
                </tbody>
              </table>
            </>
          )}

          {reportsTab === 'Accounts Receivable' && (
            <table>
              <thead><tr><th>Client</th><th>Invoice</th><th>Issue</th><th>Due</th><th>Days Overdue</th><th>Status</th><th>Amount</th></tr></thead>
              <tbody>
                {arReport.map((r) => <tr key={r.invoice_id}><td>{r.client_name}</td><td>{r.invoice_id}</td><td>{r.issue_date}</td><td>{r.due_date}</td><td>{r.days_overdue}</td><td>{r.status}</td><td>{money(r.amount)}</td></tr>)}
              </tbody>
            </table>
          )}
        </section>
      )}

      {nav === 'Manage' && (
        <section>
          <h2>Manage</h2>
          <div className="subnav">
            {['Clients', 'Expense Categories', 'Tasks'].map((x) => <button key={x} className={manageTab === x ? 'active' : ''} onClick={() => setManageTab(x)}>{x}</button>)}
          </div>

          {manageTab === 'Clients' && (
            <>
              <h3>New Client</h3>
              <form onSubmit={createClient} className="grid-form">
                <input placeholder="Name" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} required />
                <input placeholder="Address" value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} />
                <input placeholder="Currency" value={clientForm.currency} onChange={(e) => setClientForm({ ...clientForm, currency: e.target.value })} />
                <input type="number" value={clientForm.due_days} onChange={(e) => setClientForm({ ...clientForm, due_days: Number(e.target.value) })} />
                <label><input type="checkbox" checked={clientForm.active} onChange={(e) => setClientForm({ ...clientForm, active: e.target.checked })} /> Active</label>
                <button type="submit">Create Client</button>
              </form>

              <h3>Add Contact</h3>
              <form onSubmit={createContact} className="grid-form">
                <select value={contactForm.client_id} onChange={(e) => setContactForm({ ...contactForm, client_id: e.target.value })} required>
                  <option value="">Client</option>
                  {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input placeholder="First Name" value={contactForm.first_name} onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })} required />
                <input placeholder="Last Name" value={contactForm.last_name} onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })} required />
                <input placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} required />
                <input placeholder="Title" value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} />
                <input placeholder="Office Phone" value={contactForm.office_phone} onChange={(e) => setContactForm({ ...contactForm, office_phone: e.target.value })} />
                <input placeholder="Mobile" value={contactForm.mobile_phone} onChange={(e) => setContactForm({ ...contactForm, mobile_phone: e.target.value })} />
                <input placeholder="Fax" value={contactForm.fax} onChange={(e) => setContactForm({ ...contactForm, fax: e.target.value })} />
                <button type="submit">Add Contact</button>
              </form>

              <table>
                <thead><tr><th>Client</th><th>Currency</th><th>Due Days</th><th>Contacts</th></tr></thead>
                <tbody>
                  {data.clients.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td><td>{c.currency}</td><td>{c.due_days}</td>
                      <td>
                        {data.contacts.filter((ct) => ct.client_id === c.id).map((ct) => (
                          <div key={ct.id}>{ct.first_name} {ct.last_name} ({ct.email})
                            <button onClick={() => submitJSON(`/api/contacts/${ct.id}`, 'PUT', { ...ct, title: `${ct.title} Updated` }, refreshBootstrap)}>Edit</button>
                            <button onClick={() => submitJSON(`/api/contacts/${ct.id}`, 'DELETE', {}, refreshBootstrap)}>Delete</button>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {manageTab === 'Tasks' && (
            <>
              <form onSubmit={createTask} className="grid-form">
                <input placeholder="Task Name" value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} required />
                <input type="number" step="0.01" placeholder="Billable Rate" value={taskForm.billable_rate} onChange={(e) => setTaskForm({ ...taskForm, billable_rate: Number(e.target.value) })} required />
                <button type="submit">New Task</button>
              </form>
              <table>
                <thead><tr><th>Name</th><th>Rate</th><th>Archived</th><th>Actions</th></tr></thead>
                <tbody>
                  {data.tasks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td><td>{money(t.billable_rate)}</td><td>{t.archived ? 'Yes' : 'No'}</td>
                      <td className="actions">
                        <button onClick={() => submitJSON(`/api/tasks/${t.id}`, 'PUT', { ...t, name: `${t.name} Updated` }, refreshBootstrap)}>Edit</button>
                        <button onClick={() => submitJSON(`/api/tasks/${t.id}`, 'PUT', { ...t, archived: true }, refreshBootstrap)}>Archive</button>
                        <button onClick={() => submitJSON(`/api/tasks/${t.id}`, 'DELETE', {}, refreshBootstrap)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {manageTab === 'Expense Categories' && (
            <>
              <form onSubmit={createCategory} className="grid-form">
                <input placeholder="Category Name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
                <button type="submit">New Category</button>
              </form>
              <table>
                <thead><tr><th>Name</th><th>Archived</th><th>Actions</th></tr></thead>
                <tbody>
                  {data.categories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td><td>{c.archived ? 'Yes' : 'No'}</td>
                      <td className="actions">
                        <button onClick={() => submitJSON(`/api/expense-categories/${c.id}`, 'PUT', { ...c, name: `${c.name} Updated` }, refreshBootstrap)}>Edit</button>
                        <button onClick={() => submitJSON(`/api/expense-categories/${c.id}`, 'PUT', { ...c, archived: true }, refreshBootstrap)}>Archive</button>
                        <button onClick={() => submitJSON(`/api/expense-categories/${c.id}`, 'DELETE', {}, refreshBootstrap)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {nav === 'Settings' && (
        <section>
          <h2>Settings</h2>
          <form onSubmit={saveSettings} className="grid-form">
            <input placeholder="Company Name" value={data.settings.company_name || ''} onChange={(e) => setData({ ...data, settings: { ...data.settings, company_name: e.target.value } })} />
            <input placeholder="Address" value={data.settings.address || ''} onChange={(e) => setData({ ...data, settings: { ...data.settings, address: e.target.value } })} />
            <input placeholder="Contact Info" value={data.settings.contact_info || ''} onChange={(e) => setData({ ...data, settings: { ...data.settings, contact_info: e.target.value } })} />
            <input placeholder="Default Billable Rate" type="number" step="0.01" value={data.settings.default_billable_rate || 0} onChange={(e) => setData({ ...data, settings: { ...data.settings, default_billable_rate: Number(e.target.value) } })} />
            <button type="submit">Save Settings</button>
          </form>
        </section>
      )}
    </div>
  )
}

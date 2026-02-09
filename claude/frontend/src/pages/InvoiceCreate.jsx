import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function InvoiceCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [projects, setProjects] = useState([])
  const [selectedProjects, setSelectedProjects] = useState([])
  const [hoursOption, setHoursOption] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [uninvoiced, setUninvoiced] = useState({ time_entries: [], expenses: [] })
  const [selectedTimeIds, setSelectedTimeIds] = useState([])
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([])
  const [form, setForm] = useState({
    invoice_number: '',
    po_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    subject: '',
    notes: '',
  })

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data))
  }, [])

  useEffect(() => {
    if (clientId) {
      api.get(`/projects?status=active&client_id=${clientId}`).then(r => {
        setProjects(r.data)
        setSelectedProjects(r.data.map(p => p.id))
      })
      const client = clients.find(c => c.id === parseInt(clientId))
      if (client) {
        const due = new Date()
        due.setDate(due.getDate() + client.invoice_due_days)
        setForm(f => ({ ...f, due_date: due.toISOString().split('T')[0] }))
      }
    }
  }, [clientId, clients])

  const loadUninvoiced = async () => {
    let params = new URLSearchParams({ client_id: clientId })
    selectedProjects.forEach(p => params.append('project_ids', p))
    if (hoursOption === 'period' && startDate) params.append('start_date', startDate)
    if (hoursOption === 'period' && endDate) params.append('end_date', endDate)
    if (hoursOption === 'current_month') {
      const now = new Date()
      params.append('start_date', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      params.append('end_date', last.toISOString().split('T')[0])
    }
    if (hoursOption === 'last_month') {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      params.append('start_date', first.toISOString().split('T')[0])
      params.append('end_date', last.toISOString().split('T')[0])
    }
    const res = await api.get(`/invoices/uninvoiced?${params.toString()}`)
    setUninvoiced(res.data)
    setSelectedTimeIds(res.data.time_entries.map(t => t.id))
    setSelectedExpenseIds(res.data.expenses.map(e => e.id))
  }

  const goToStep2 = () => {
    if (!clientId) return
    loadUninvoiced()
    setStep(2)
  }

  const goToStep3 = () => {
    setStep(3)
  }

  const createInvoice = async () => {
    try {
      const res = await api.post('/invoices', {
        client_id: parseInt(clientId),
        invoice_number: form.invoice_number,
        po_number: form.po_number,
        issue_date: form.issue_date,
        due_date: form.due_date,
        subject: form.subject,
        notes: form.notes,
        time_entry_ids: selectedTimeIds,
        expense_ids: selectedExpenseIds,
      })
      navigate(`/invoices/${res.data.id}`)
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating invoice')
    }
  }

  const toggleProject = (id) => {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const toggleTime = (id) => {
    setSelectedTimeIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleExpense = (id) => {
    setSelectedExpenseIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const totalHours = uninvoiced.time_entries
    .filter(t => selectedTimeIds.includes(t.id))
    .reduce((s, t) => s + t.hours, 0)

  const totalExpenses = uninvoiced.expenses
    .filter(e => selectedExpenseIds.includes(e.id))
    .reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <div className="page-header">
        <h1>Create Invoice</h1>
      </div>

      <div className="tabs">
        <button className={step === 1 ? 'active' : ''} onClick={() => setStep(1)}>1. Select Client</button>
        <button className={step === 2 ? 'active' : ''} disabled={!clientId}>2. Select Hours & Expenses</button>
        <button className={step === 3 ? 'active' : ''} disabled={step < 3}>3. Invoice Details</button>
      </div>

      {step === 1 && (
        <div className="card">
          <div className="form-group">
            <label>Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {clientId && projects.length > 0 && (
            <div className="form-group">
              <label>Projects to include</label>
              {projects.map(p => (
                <label key={p.id} className="checkbox-label" style={{ display: 'block', marginBottom: 4 }}>
                  <input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={() => toggleProject(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
          <div className="form-group">
            <label>Hours to include</label>
            <select value={hoursOption} onChange={e => setHoursOption(e.target.value)}>
              <option value="all">All uninvoiced hours</option>
              <option value="current_month">Current Month</option>
              <option value="last_month">Last Month</option>
              <option value="period">Custom period</option>
            </select>
          </div>
          {hoursOption === 'period' && (
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={goToStep2} disabled={!clientId}>Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Uninvoiced Time Entries ({totalHours.toFixed(2)} hours selected)</h3>
          {uninvoiced.time_entries.length === 0 ? (
            <p className="empty-state">No uninvoiced time entries</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selectedTimeIds.length === uninvoiced.time_entries.length} onChange={() => setSelectedTimeIds(selectedTimeIds.length === uninvoiced.time_entries.length ? [] : uninvoiced.time_entries.map(t => t.id))} /></th>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Task</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {uninvoiced.time_entries.map(t => (
                  <tr key={t.id}>
                    <td><input type="checkbox" checked={selectedTimeIds.includes(t.id)} onChange={() => toggleTime(t.id)} /></td>
                    <td>{t.date}</td>
                    <td>{t.project_name}</td>
                    <td>{t.task_name}</td>
                    <td>{t.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginTop: 24, marginBottom: 16 }}>Uninvoiced Expenses (${totalExpenses.toFixed(2)} selected)</h3>
          {uninvoiced.expenses.length === 0 ? (
            <p className="empty-state">No uninvoiced expenses</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selectedExpenseIds.length === uninvoiced.expenses.length} onChange={() => setSelectedExpenseIds(selectedExpenseIds.length === uninvoiced.expenses.length ? [] : uninvoiced.expenses.map(e => e.id))} /></th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Notes</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {uninvoiced.expenses.map(e => (
                  <tr key={e.id}>
                    <td><input type="checkbox" checked={selectedExpenseIds.includes(e.id)} onChange={() => toggleExpense(e.id)} /></td>
                    <td>{e.date}</td>
                    <td>{e.category_name}</td>
                    <td>{e.notes}</td>
                    <td>${e.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={goToStep3}>Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="form-row">
            <div className="form-group">
              <label>Invoice Number</label>
              <input type="text" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label>PO Number</label>
              <input type="text" value={form.po_number} onChange={e => setForm({ ...form, po_number: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Issue Date</label>
              <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Subject</label>
            <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div style={{ marginTop: 16, padding: 16, background: '#f8f8f8', borderRadius: 8 }}>
            <strong>Summary:</strong>
            <p>Time: {totalHours.toFixed(2)} hours selected</p>
            <p>Expenses: ${totalExpenses.toFixed(2)} selected</p>
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" onClick={createInvoice} disabled={!form.invoice_number || !form.due_date}>
              Create Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import api from '../api'

function InvoicesReport() {
  const [data, setData] = useState([])
  const [clients, setClients] = useState([])
  const [clientFilter, setClientFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [sortBy, setSortBy] = useState('client_name')
  const [sortDir, setSortDir] = useState('asc')

  const load = async () => {
    let params = new URLSearchParams()
    if (clientFilter) params.append('client_id', clientFilter)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (activeOnly) params.append('active_clients', 'true')
    params.append('sort_by', sortBy)
    params.append('sort_dir', sortDir)

    const [reportRes, clientRes] = await Promise.all([
      api.get(`/reports/invoices?${params.toString()}`),
      api.get('/clients'),
    ])
    setData(reportRes.data)
    setClients(clientRes.data)
  }

  useEffect(() => { load() }, [clientFilter, startDate, endDate, activeOnly, sortBy, sortDir])

  const exportCsv = () => {
    let params = new URLSearchParams()
    if (clientFilter) params.append('client_id', clientFilter)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    if (activeOnly) params.append('active_clients', 'true')
    window.open(`/api/reports/invoices/csv?${params.toString()}`, '_blank')
  }

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  const totalHours = data.reduce((s, d) => s + d.total_hours, 0)
  const totalAmount = data.reduce((s, d) => s + d.amount, 0)

  return (
    <div>
      <div className="page-header">
        <h2>Invoices Report</h2>
        <button className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="filters">
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <label className="checkbox-label">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
          Active clients only
        </label>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('client_name')}>
                Client {sortBy === 'client_name' && (sortDir === 'asc' ? '▲' : '▼')}
              </th>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Status</th>
              <th>Hours</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount')}>
                Amount {sortBy === 'amount' && (sortDir === 'asc' ? '▲' : '▼')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">No invoices found</td></tr>
            ) : (
              <>
                {data.map(d => (
                  <tr key={d.id}>
                    <td>{d.client_name}</td>
                    <td>{d.invoice_number}</td>
                    <td>{d.issue_date}</td>
                    <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                    <td>{d.total_hours.toFixed(2)}</td>
                    <td>${d.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid #333' }}>
                  <td colSpan={4}>Total</td>
                  <td>{totalHours.toFixed(2)}</td>
                  <td>${totalAmount.toFixed(2)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AccountsReceivable() {
  const [data, setData] = useState([])

  useEffect(() => {
    api.get('/reports/accounts-receivable').then(r => setData(r.data))
  }, [])

  const total = data.reduce((s, d) => s + d.amount, 0)
  const currentItems = data.filter(d => !d.is_overdue)
  const overdueItems = data.filter(d => d.is_overdue)

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Accounts Receivable</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Invoice #</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Days Outstanding</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={7} className="empty-state">No outstanding invoices</td></tr>
            ) : (
              <>
                {overdueItems.length > 0 && (
                  <>
                    <tr className="client-group-header"><td colSpan={7}>Overdue</td></tr>
                    {overdueItems.map(d => (
                      <tr key={d.id} style={{ color: '#dc3545' }}>
                        <td>{d.client_name}</td>
                        <td>{d.invoice_number}</td>
                        <td>{d.issue_date}</td>
                        <td>{d.due_date}</td>
                        <td><span className="badge badge-overdue">Overdue</span></td>
                        <td>{d.days_outstanding} days</td>
                        <td>${d.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </>
                )}
                {currentItems.length > 0 && (
                  <>
                    <tr className="client-group-header"><td colSpan={7}>Current</td></tr>
                    {currentItems.map(d => (
                      <tr key={d.id}>
                        <td>{d.client_name}</td>
                        <td>{d.invoice_number}</td>
                        <td>{d.issue_date}</td>
                        <td>{d.due_date}</td>
                        <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                        <td>{d.days_outstanding} days</td>
                        <td>${d.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </>
                )}
                <tr style={{ fontWeight: 700, borderTop: '2px solid #333' }}>
                  <td colSpan={6}>Total Outstanding</td>
                  <td>${total.toFixed(2)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
      </div>
      <div className="tabs">
        <NavLink to="/reports/invoices" className={({ isActive }) => isActive ? 'active' : ''}>Invoices</NavLink>
        <NavLink to="/reports/accounts-receivable" className={({ isActive }) => isActive ? 'active' : ''}>Accounts Receivable</NavLink>
      </div>
      <Routes>
        <Route path="/" element={<Navigate to="invoices" replace />} />
        <Route path="invoices" element={<InvoicesReport />} />
        <Route path="accounts-receivable" element={<AccountsReceivable />} />
      </Routes>
    </div>
  )
}

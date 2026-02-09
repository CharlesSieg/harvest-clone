import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = async () => {
    let params = new URLSearchParams()
    if (clientFilter) params.append('client_id', clientFilter)
    if (statusFilter) params.append('status', statusFilter)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const [invRes, clientRes] = await Promise.all([
      api.get(`/invoices?${params.toString()}`),
      api.get('/clients'),
    ])
    setInvoices(invRes.data)
    setClients(clientRes.data)
  }

  useEffect(() => { load() }, [clientFilter, statusFilter, startDate, endDate])

  return (
    <div>
      <div className="page-header">
        <h1>Invoices</h1>
        <Link to="/invoices/new" className="btn btn-primary">New Invoice</Link>
      </div>

      <div className="filters">
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="written_off">Written Off</option>
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="Start Date" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="End Date" />
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Due</th>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">No invoices found</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id}>
                <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                <td>{inv.due_status}</td>
                <td>{inv.issue_date}</td>
                <td><Link to={`/invoices/${inv.id}`}>{inv.invoice_number}</Link></td>
                <td>{inv.client_name}</td>
                <td>${parseFloat(inv.total_amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

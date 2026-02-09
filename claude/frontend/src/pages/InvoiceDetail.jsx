import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const load = async () => {
    const res = await api.get(`/invoices/${id}`)
    setInvoice(res.data)
    setForm({
      invoice_number: res.data.invoice_number,
      po_number: res.data.po_number,
      issue_date: res.data.issue_date,
      due_date: res.data.due_date,
      subject: res.data.subject,
      notes: res.data.notes,
    })
  }

  useEffect(() => { load() }, [id])

  const save = async () => {
    await api.put(`/invoices/${id}`, form)
    setEditing(false)
    load()
  }

  const deleteInvoice = async () => {
    if (confirm('Delete this invoice?')) {
      await api.delete(`/invoices/${id}`)
      navigate('/invoices')
    }
  }

  const writeOff = async () => {
    if (confirm('Write off this invoice?')) {
      await api.put(`/invoices/${id}/write-off`)
      load()
    }
  }

  const markSent = async () => {
    await api.post(`/invoices/${id}/send`)
    load()
  }

  const markPaid = async () => {
    await api.put(`/invoices/${id}`, { status: 'paid' })
    load()
  }

  const downloadPdf = () => {
    window.open(`/api/invoices/${id}/pdf`, '_blank')
  }

  if (!invoice) return <div>Loading...</div>

  const timeItems = invoice.line_items?.filter(li => li.line_type === 'time') || []
  const expenseItems = invoice.line_items?.filter(li => li.line_type === 'expense') || []

  return (
    <div>
      <div className="page-header">
        <h1>Invoice #{invoice.invoice_number}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {invoice.status === 'draft' && (
            <button className="btn btn-primary" onClick={markSent}>Mark as Sent</button>
          )}
          {invoice.status === 'sent' && (
            <button className="btn btn-primary" onClick={markPaid}>Mark as Paid</button>
          )}
          <button className="btn btn-secondary" onClick={downloadPdf}>PDF</button>
          <button className="btn btn-secondary" onClick={() => setEditing(!editing)}>Edit</button>
          {invoice.status !== 'paid' && (
            <button className="btn btn-secondary" onClick={writeOff}>Write Off</button>
          )}
          <button className="btn btn-danger" onClick={deleteInvoice}>Delete</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
      </div>

      {editing ? (
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
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      ) : (
        <div className="invoice-preview">
          <div className="invoice-header">
            <div>
              <div className="invoice-title">INVOICE</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>Invoice #: <strong>{invoice.invoice_number}</strong></div>
              {invoice.po_number && <div>PO #: {invoice.po_number}</div>}
              <div>Date: {invoice.issue_date}</div>
              <div>Due: {invoice.due_date}</div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <strong>Bill To:</strong>
            <div>{invoice.client_name}</div>
          </div>

          {invoice.subject && (
            <div style={{ marginBottom: 20 }}>
              <strong>Subject:</strong> {invoice.subject}
            </div>
          )}

          {timeItems.length > 0 && (
            <>
              <h3 style={{ marginBottom: 8 }}>Time</h3>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Hours</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {timeItems.map(li => (
                    <tr key={li.id}>
                      <td>{li.description}</td>
                      <td style={{ textAlign: 'right' }}>{li.quantity.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>${li.rate.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>${li.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {expenseItems.length > 0 && (
            <>
              <h3 style={{ marginTop: 20, marginBottom: 8 }}>Expenses</h3>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseItems.map(li => (
                    <tr key={li.id}>
                      <td>{li.description}</td>
                      <td style={{ textAlign: 'right' }}>${li.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="invoice-total">
            Total: ${parseFloat(invoice.total_amount).toFixed(2)}
          </div>

          {invoice.notes && (
            <div style={{ marginTop: 20, color: '#666', fontSize: 13 }}>
              <strong>Notes:</strong> {invoice.notes}
            </div>
          )}
        </div>
      )}

      {/* Invoice History */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 12 }}>History</h3>
        {invoice.history && invoice.history.length > 0 ? (
          <ul className="history-list">
            {invoice.history.map(h => (
              <li key={h.id}>
                <strong>{h.action}</strong> - {new Date(h.timestamp).toLocaleString()}
                {h.notes && <span> - {h.notes}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No history</p>
        )}
      </div>
    </div>
  )
}

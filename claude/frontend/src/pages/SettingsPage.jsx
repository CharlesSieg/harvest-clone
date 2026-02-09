import { useState, useEffect } from 'react'
import api from '../api'

export default function SettingsPage() {
  const [form, setForm] = useState({
    company_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    default_billable_rate: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/settings').then(res => setForm(res.data))
  }, [])

  const save = async () => {
    await api.put('/settings', form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="form-group">
          <label>Company Name</label>
          <input type="text" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Address</label>
          <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>City</label>
            <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="form-group">
            <label>State</label>
            <input type="text" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
          </div>
          <div className="form-group">
            <label>ZIP</label>
            <input type="text" value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Default Billable Rate ($/hr)</label>
          <input type="number" step="0.01" value={form.default_billable_rate} onChange={e => setForm({ ...form, default_billable_rate: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={save}>Save Settings</button>
          {saved && <span style={{ color: 'green', marginLeft: 12 }}>Saved!</span>}
        </div>
      </div>
    </div>
  )
}

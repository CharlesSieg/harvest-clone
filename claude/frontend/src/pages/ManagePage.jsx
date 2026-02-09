import { useState, useEffect } from 'react'
import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'

function ClientsTab() {
  const [clients, setClients] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', zip_code: '', currency: 'USD', invoice_due_days: 30 })

  // Contact state
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [contactClientId, setContactClientId] = useState(null)
  const [contactForm, setContactForm] = useState({ first_name: '', last_name: '', email: '', title: '', office_phone: '', mobile_phone: '', fax: '' })

  const load = async () => {
    const res = await api.get('/clients')
    setClients(res.data)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', address: '', city: '', state: '', zip_code: '', currency: 'USD', invoice_due_days: 30 })
    setShowModal(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({
      name: c.name,
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      zip_code: c.zip_code || '',
      currency: c.currency || 'USD',
      invoice_due_days: c.invoice_due_days || 30,
    })
    setShowModal(true)
  }

  const save = async () => {
    if (editing) {
      await api.put(`/clients/${editing.id}`, form)
    } else {
      await api.post('/clients', form)
    }
    setShowModal(false)
    load()
  }

  const deleteClient = async (id) => {
    if (confirm('Delete this client?')) {
      await api.delete(`/clients/${id}`)
      load()
    }
  }

  const openNewContact = (clientId) => {
    setEditingContact(null)
    setContactClientId(clientId)
    setContactForm({ first_name: '', last_name: '', email: '', title: '', office_phone: '', mobile_phone: '', fax: '' })
    setShowContactModal(true)
  }

  const openEditContact = (contact) => {
    setEditingContact(contact)
    setContactClientId(contact.client_id)
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      title: contact.title || '',
      office_phone: contact.office_phone || '',
      mobile_phone: contact.mobile_phone || '',
      fax: contact.fax || '',
    })
    setShowContactModal(true)
  }

  const saveContact = async () => {
    if (editingContact) {
      await api.put(`/contacts/${editingContact.id}`, contactForm)
    } else {
      await api.post(`/clients/${contactClientId}/contacts`, contactForm)
    }
    setShowContactModal(false)
    load()
  }

  const deleteContact = async (id) => {
    if (confirm('Delete this contact?')) {
      await api.delete(`/contacts/${id}`)
      load()
    }
  }

  const dueDaysLabel = (days) => {
    if (days === 0) return 'Upon receipt'
    if (days === 15) return 'Net 15'
    if (days === 30) return 'Net 30'
    if (days === 45) return 'Net 45'
    if (days === 60) return 'Net 60'
    return `Net ${days}`
  }

  return (
    <div>
      <div className="page-header">
        <h2>Clients</h2>
        <button className="btn btn-primary" onClick={openNew}>New Client</button>
      </div>
      <div className="card">
        {clients.length === 0 ? (
          <div className="empty-state">No clients yet</div>
        ) : clients.map(c => (
          <div key={c.id} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 15 }}>{c.name}</strong>
                <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{c.currency} | {dueDaysLabel(c.invoice_due_days)}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-link btn-sm" onClick={() => openNewContact(c.id)}>Add Contact</button>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteClient(c.id)}>Delete</button>
              </div>
            </div>
            {c.contacts && c.contacts.length > 0 && (
              <div style={{ marginTop: 8, paddingLeft: 20 }}>
                {c.contacts.map(contact => (
                  <div key={contact.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13, color: '#666' }}>
                    <span>
                      {contact.first_name} {contact.last_name}
                      {contact.title && <span> - {contact.title}</span>}
                      {contact.email && <span> ({contact.email})</span>}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-link btn-sm" onClick={() => openEditContact(contact)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteContact(contact.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Client' : 'New Client'}>
        <div className="form-group">
          <label>Client Name</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
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
            <label>Currency</label>
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>
          <div className="form-group">
            <label>Default Invoice Due</label>
            <select value={form.invoice_due_days} onChange={e => setForm({ ...form, invoice_due_days: parseInt(e.target.value) })}>
              <option value={0}>Upon receipt</option>
              <option value={15}>Net 15</option>
              <option value={30}>Net 30</option>
              <option value={45}>Net 45</option>
              <option value={60}>Net 60</option>
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </Modal>

      <Modal isOpen={showContactModal} onClose={() => setShowContactModal(false)} title={editingContact ? 'Edit Contact' : 'Add Contact'}>
        <div className="form-row">
          <div className="form-group">
            <label>First Name</label>
            <input type="text" value={contactForm.first_name} onChange={e => setContactForm({ ...contactForm, first_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input type="text" value={contactForm.last_name} onChange={e => setContactForm({ ...contactForm, last_name: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Title</label>
            <input type="text" value={contactForm.title} onChange={e => setContactForm({ ...contactForm, title: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Office Phone</label>
            <input type="text" value={contactForm.office_phone} onChange={e => setContactForm({ ...contactForm, office_phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Mobile</label>
            <input type="text" value={contactForm.mobile_phone} onChange={e => setContactForm({ ...contactForm, mobile_phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>FAX</label>
            <input type="text" value={contactForm.fax} onChange={e => setContactForm({ ...contactForm, fax: e.target.value })} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveContact}>Save</button>
        </div>
      </Modal>
    </div>
  )
}

function TasksTab() {
  const [tasks, setTasks] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', billable_rate: '' })
  const [showArchived, setShowArchived] = useState(false)

  const load = async () => {
    const res = await api.get(`/tasks?include_archived=${showArchived}`)
    setTasks(res.data)
  }

  useEffect(() => { load() }, [showArchived])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', billable_rate: '' })
    setShowModal(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({ name: t.name, billable_rate: t.billable_rate })
    setShowModal(true)
  }

  const save = async () => {
    if (editing) {
      await api.put(`/tasks/${editing.id}`, form)
    } else {
      await api.post('/tasks', form)
    }
    setShowModal(false)
    load()
  }

  const archive = async (t) => {
    await api.put(`/tasks/${t.id}/archive`)
    load()
  }

  const remove = async (t) => {
    if (confirm('Delete this task?')) {
      try {
        await api.delete(`/tasks/${t.id}`)
        load()
      } catch (err) {
        alert(err.response?.data?.error || 'Cannot delete')
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Tasks</h2>
        <button className="btn btn-primary" onClick={openNew}>New Task</button>
      </div>
      <div className="filters">
        <label className="checkbox-label">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Billable Rate</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr><td colSpan={4} className="empty-state">No tasks</td></tr>
            ) : tasks.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>${parseFloat(t.billable_rate).toFixed(2)}/hr</td>
                <td>{t.archived ? <span className="badge badge-draft">Archived</span> : <span className="badge badge-paid">Active</span>}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>Edit</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => archive(t)} style={{ marginLeft: 4 }}>{t.archived ? 'Unarchive' : 'Archive'}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(t)} style={{ marginLeft: 4 }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Task' : 'New Task'}>
        <div className="form-group">
          <label>Task Name</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Billable Rate ($/hr)</label>
          <input type="number" step="0.01" value={form.billable_rate} onChange={e => setForm({ ...form, billable_rate: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  )
}

function ExpenseCategoriesTab() {
  const [categories, setCategories] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const load = async () => {
    const res = await api.get(`/expense-categories?include_archived=${showArchived}`)
    setCategories(res.data)
  }

  useEffect(() => { load() }, [showArchived])

  const openNew = () => {
    setEditing(null)
    setName('')
    setShowModal(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setName(c.name)
    setShowModal(true)
  }

  const save = async () => {
    if (editing) {
      await api.put(`/expense-categories/${editing.id}`, { name })
    } else {
      await api.post('/expense-categories', { name })
    }
    setShowModal(false)
    load()
  }

  const archive = async (c) => {
    await api.put(`/expense-categories/${c.id}/archive`)
    load()
  }

  const remove = async (c) => {
    if (confirm('Delete this category?')) {
      try {
        await api.delete(`/expense-categories/${c.id}`)
        load()
      } catch (err) {
        alert(err.response?.data?.error || 'Cannot delete')
      }
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Expense Categories</h2>
        <button className="btn btn-primary" onClick={openNew}>New Category</button>
      </div>
      <div className="filters">
        <label className="checkbox-label">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan={3} className="empty-state">No categories</td></tr>
            ) : categories.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.archived ? <span className="badge badge-draft">Archived</span> : <span className="badge badge-paid">Active</span>}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => archive(c)} style={{ marginLeft: 4 }}>{c.archived ? 'Unarchive' : 'Archive'}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(c)} style={{ marginLeft: 4 }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <div className="form-group">
          <label>Category Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  )
}

export default function ManagePage() {
  return (
    <div>
      <div className="page-header">
        <h1>Manage</h1>
      </div>
      <div className="tabs">
        <NavLink to="/manage/clients" className={({ isActive }) => isActive ? 'active' : ''}>Clients</NavLink>
        <NavLink to="/manage/tasks" className={({ isActive }) => isActive ? 'active' : ''}>Tasks</NavLink>
        <NavLink to="/manage/expense-categories" className={({ isActive }) => isActive ? 'active' : ''}>Expense Categories</NavLink>
      </div>
      <Routes>
        <Route path="/" element={<Navigate to="clients" replace />} />
        <Route path="clients" element={<ClientsTab />} />
        <Route path="tasks" element={<TasksTab />} />
        <Route path="expense-categories" element={<ExpenseCategoriesTab />} />
      </Routes>
    </div>
  )
}

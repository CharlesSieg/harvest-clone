import { useState, useEffect } from 'react'
import api from '../api'
import Modal from '../components/Modal'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], project_id: '', category_id: '', notes: '', amount: '' })
  const [file, setFile] = useState(null)

  const load = async () => {
    const [expRes, projRes, catRes] = await Promise.all([
      api.get('/expenses'),
      api.get('/projects?status=active'),
      api.get('/expense-categories'),
    ])
    setExpenses(expRes.data)
    setProjects(projRes.data)
    setCategories(catRes.data)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ date: new Date().toISOString().split('T')[0], project_id: '', category_id: '', notes: '', amount: '' })
    setFile(null)
    setShowModal(true)
  }

  const openEdit = (exp) => {
    setEditing(exp)
    setForm({ date: exp.date, project_id: exp.project_id, category_id: exp.category_id, notes: exp.notes, amount: exp.amount })
    setFile(null)
    setShowModal(true)
  }

  const save = async () => {
    const fd = new FormData()
    fd.append('date', form.date)
    fd.append('project_id', form.project_id)
    fd.append('category_id', form.category_id)
    fd.append('notes', form.notes)
    fd.append('amount', form.amount)
    if (file) fd.append('file', file)

    if (editing) {
      await api.put(`/expenses/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    } else {
      await api.post('/expenses', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    setShowModal(false)
    load()
  }

  const remove = async (id) => {
    if (confirm('Delete this expense?')) {
      await api.delete(`/expenses/${id}`)
      load()
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Expenses</h1>
        <button className="btn btn-primary" onClick={openNew}>New Expense</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client / Project</th>
              <th>Category</th>
              <th>Notes</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={7} className="empty-state">No expenses recorded</td></tr>
            ) : expenses.map(exp => (
              <tr key={exp.id}>
                <td>{exp.date}</td>
                <td>{exp.client_name} - {exp.project_name}</td>
                <td>{exp.category_name}</td>
                <td>{exp.notes}</td>
                <td>${parseFloat(exp.amount).toFixed(2)}</td>
                <td>
                  {exp.file_path && (
                    <a href={`/uploads/${exp.file_path}`} target="_blank" rel="noreferrer" className="btn btn-link btn-sm">View</a>
                  )}
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(exp)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(exp.id)} style={{ marginLeft: 4 }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Expense' : 'New Expense'}>
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Project</label>
          <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.client_name} - {p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select category...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Amount</label>
          <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Attach Receipt</label>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  )
}

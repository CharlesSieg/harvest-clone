import { useState, useEffect } from 'react'
import api from '../api'
import Modal from '../components/Modal'

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [statusFilter, setStatusFilter] = useState('active')
  const [clientFilter, setClientFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ client_id: '', name: '', code: '', start_date: '', end_date: '', notes: '', task_ids: [] })
  const [openMenu, setOpenMenu] = useState(null)

  const load = async () => {
    let url = `/projects?status=${statusFilter}`
    if (clientFilter) url += `&client_id=${clientFilter}`
    const [projRes, clientRes, taskRes] = await Promise.all([
      api.get(url),
      api.get('/clients'),
      api.get('/tasks?include_archived=true'),
    ])
    setProjects(projRes.data)
    setClients(clientRes.data)
    setTasks(taskRes.data)
  }

  useEffect(() => { load() }, [statusFilter, clientFilter])

  const openNew = () => {
    setEditing(null)
    setForm({ client_id: '', name: '', code: '', start_date: '', end_date: '', notes: '', task_ids: [] })
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      client_id: p.client_id,
      name: p.name,
      code: p.code || '',
      start_date: p.start_date || '',
      end_date: p.end_date || '',
      notes: p.notes || '',
      task_ids: p.tasks.map(t => t.id),
    })
    setOpenMenu(null)
    setShowModal(true)
  }

  const save = async () => {
    const data = { ...form }
    if (editing) {
      await api.put(`/projects/${editing.id}`, data)
    } else {
      await api.post('/projects', data)
    }
    setShowModal(false)
    load()
  }

  const archive = async (p) => {
    await api.put(`/projects/${p.id}/archive`)
    setOpenMenu(null)
    load()
  }

  const duplicate = async (p) => {
    await api.post(`/projects/${p.id}/duplicate`)
    setOpenMenu(null)
    load()
  }

  const remove = async (p) => {
    if (confirm('Delete this project? This cannot be undone.')) {
      try {
        await api.delete(`/projects/${p.id}`)
        setOpenMenu(null)
        load()
      } catch (err) {
        alert(err.response?.data?.error || 'Cannot delete')
      }
    }
  }

  const toggleTask = (taskId) => {
    setForm(f => ({
      ...f,
      task_ids: f.task_ids.includes(taskId)
        ? f.task_ids.filter(id => id !== taskId)
        : [...f.task_ids, taskId]
    }))
  }

  // Group projects by client
  const grouped = {}
  projects.forEach(p => {
    if (!grouped[p.client_name]) grouped[p.client_name] = []
    grouped[p.client_name].push(p)
  })

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={openNew}>New Project</button>
      </div>

      <div className="filters">
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>All</button>
          <button className={statusFilter === 'active' ? 'active' : ''} onClick={() => setStatusFilter('active')}>Active</button>
          <button className={statusFilter === 'archived' ? 'active' : ''} onClick={() => setStatusFilter('archived')}>Archived</button>
        </div>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Code</th>
              <th>Dates</th>
              <th>Tasks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(grouped).length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No projects found</td></tr>
            ) : Object.entries(grouped).map(([clientName, projs]) => (
              <>
                <tr key={`client-${clientName}`} className="client-group-header">
                  <td colSpan={5}>{clientName}</td>
                </tr>
                {projs.map(p => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      {p.archived && <span className="badge badge-draft" style={{ marginLeft: 8 }}>Archived</span>}
                    </td>
                    <td>{p.code}</td>
                    <td>
                      {p.start_date && p.end_date
                        ? `${p.start_date} - ${p.end_date}`
                        : p.start_date || p.end_date || '-'}
                    </td>
                    <td>{p.tasks.map(t => t.name).join(', ')}</td>
                    <td>
                      <div className="actions-menu">
                        <button className="btn btn-secondary btn-sm" onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}>
                          Actions
                        </button>
                        {openMenu === p.id && (
                          <div className="actions-dropdown">
                            <button onClick={() => openEdit(p)}>Edit</button>
                            <button onClick={() => duplicate(p)}>Duplicate</button>
                            <button onClick={() => archive(p)}>{p.archived ? 'Unarchive' : 'Archive'}</button>
                            <button className="danger" onClick={() => remove(p)}>Delete</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Project' : 'New Project'}>
        <div className="form-group">
          <label>Client</label>
          <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Project Name</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Project Code (optional)</label>
            <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Start Date (optional)</label>
            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label>End Date (optional)</label>
            <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Tasks</label>
          <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ddd', borderRadius: 6, padding: 8 }}>
            {tasks.filter(t => !t.archived).map(t => (
              <label key={t.id} className="checkbox-label" style={{ display: 'block', marginBottom: 4 }}>
                <input type="checkbox" checked={form.task_ids.includes(t.id)} onChange={() => toggleTask(t.id)} />
                {t.name} (${t.billable_rate}/hr)
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </Modal>
    </div>
  )
}

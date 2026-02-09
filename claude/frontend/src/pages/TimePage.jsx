import { useState, useEffect, useCallback } from 'react'
import api from '../api'

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function formatDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function TimePage() {
  const [view, setView] = useState('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [showFillMonth, setShowFillMonth] = useState(false)
  const [fillData, setFillData] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, hours: 8, project_id: '', task_id: '' })

  // Day view state
  const [dayEntries, setDayEntries] = useState([])
  const [newEntry, setNewEntry] = useState({ project_id: '', task_id: '', hours: '', notes: '' })

  const monday = getMonday(new Date(currentDate))
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return formatDate(d)
  })

  const loadData = useCallback(async () => {
    const [projRes, taskRes] = await Promise.all([
      api.get('/projects?status=active'),
      api.get('/tasks'),
    ])
    setProjects(projRes.data)
    setAllTasks(taskRes.data)
  }, [])

  const loadEntries = useCallback(async () => {
    if (view === 'week') {
      const start = weekDates[0]
      const end = weekDates[6]
      const res = await api.get(`/time-entries?start_date=${start}&end_date=${end}`)
      setEntries(res.data)
    } else {
      const dateStr = formatDate(currentDate)
      const res = await api.get(`/time-entries?start_date=${dateStr}&end_date=${dateStr}`)
      setDayEntries(res.data)
    }
  }, [view, currentDate, weekDates[0], weekDates[6]])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadEntries() }, [view, currentDate, loadEntries])

  // Week view helpers
  const getWeekRows = () => {
    const rows = {}
    entries.forEach(e => {
      const key = `${e.project_id}-${e.task_id}`
      if (!rows[key]) {
        rows[key] = {
          project_id: e.project_id,
          task_id: e.task_id,
          project_name: e.project_name,
          client_name: e.client_name,
          task_name: e.task_name,
          entries: {},
        }
      }
      rows[key].entries[e.date] = e
    })
    return Object.values(rows)
  }

  const handleWeekCellChange = async (projectId, taskId, dateStr, value) => {
    const hours = parseFloat(value) || 0
    const existing = entries.find(e => e.project_id === projectId && e.task_id === taskId && e.date === dateStr)

    if (existing) {
      if (hours === 0) {
        await api.delete(`/time-entries/${existing.id}`)
      } else {
        await api.put(`/time-entries/${existing.id}`, { hours })
      }
    } else if (hours > 0) {
      await api.post('/time-entries', { date: dateStr, hours, project_id: projectId, task_id: taskId })
    }
    loadEntries()
  }

  const [addingRow, setAddingRow] = useState(false)
  const [newRow, setNewRow] = useState({ project_id: '', task_id: '' })

  const addWeekRow = () => {
    if (!newRow.project_id || !newRow.task_id) return
    // Just create an empty entry to establish the row
    const firstWeekday = weekDates.find(d => {
      const day = new Date(d + 'T00:00:00').getDay()
      return day >= 1 && day <= 5
    })
    api.post('/time-entries', {
      date: firstWeekday,
      hours: 0,
      project_id: parseInt(newRow.project_id),
      task_id: parseInt(newRow.task_id),
    }).then(() => {
      setAddingRow(false)
      setNewRow({ project_id: '', task_id: '' })
      loadEntries()
    })
  }

  // Day view handlers
  const addDayEntry = async () => {
    if (!newEntry.project_id || !newEntry.task_id || !newEntry.hours) return
    await api.post('/time-entries', {
      date: formatDate(currentDate),
      hours: parseFloat(newEntry.hours),
      project_id: parseInt(newEntry.project_id),
      task_id: parseInt(newEntry.task_id),
      notes: newEntry.notes,
    })
    setNewEntry({ project_id: '', task_id: '', hours: '', notes: '' })
    loadEntries()
  }

  const deleteDayEntry = async (id) => {
    await api.delete(`/time-entries/${id}`)
    loadEntries()
  }

  // Fill month handler
  const handleFillMonth = async () => {
    if (!fillData.project_id || !fillData.task_id) return
    await api.post('/time-entries/fill-month', {
      year: parseInt(fillData.year),
      month: parseInt(fillData.month),
      hours: parseFloat(fillData.hours),
      project_id: parseInt(fillData.project_id),
      task_id: parseInt(fillData.task_id),
    })
    setShowFillMonth(false)
    loadEntries()
  }

  const navigate = (dir) => {
    const d = new Date(currentDate)
    if (view === 'week') {
      d.setDate(d.getDate() + dir * 7)
    } else {
      d.setDate(d.getDate() + dir)
    }
    setCurrentDate(d)
  }

  const getTasksForProject = (projectId) => {
    const proj = projects.find(p => p.id === parseInt(projectId))
    return proj ? proj.tasks : []
  }

  const weekRows = getWeekRows()
  const dayTotal = dayEntries.reduce((s, e) => s + e.hours, 0)

  return (
    <div>
      <div className="page-header">
        <h1>Time</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setShowFillMonth(!showFillMonth)}>
            Fill Month
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>Day</button>
        <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Week</button>
      </div>

      {showFillMonth && (
        <div className="fill-month-form">
          <div className="form-group">
            <label>Year</label>
            <input type="number" value={fillData.year} onChange={e => setFillData({ ...fillData, year: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Month</label>
            <select value={fillData.month} onChange={e => setFillData({ ...fillData, month: e.target.value })}>
              {[...Array(12)].map((_, i) => (
                <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Hours/day</label>
            <input type="number" step="0.5" value={fillData.hours} onChange={e => setFillData({ ...fillData, hours: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Project</label>
            <select value={fillData.project_id} onChange={e => setFillData({ ...fillData, project_id: e.target.value, task_id: '' })}>
              <option value="">Select...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.client_name} - {p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Task</label>
            <select value={fillData.task_id} onChange={e => setFillData({ ...fillData, task_id: e.target.value })}>
              <option value="">Select...</option>
              {getTasksForProject(fillData.project_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleFillMonth}>Fill Weekdays</button>
        </div>
      )}

      <div className="week-nav">
        <button onClick={() => navigate(-1)}>&larr;</button>
        <strong>
          {view === 'week'
            ? `${formatDisplay(weekDates[0])} - ${formatDisplay(weekDates[6])}`
            : formatDisplay(formatDate(currentDate))
          }
        </strong>
        <button onClick={() => navigate(1)}>&rarr;</button>
        <button onClick={() => setCurrentDate(new Date())}>Today</button>
      </div>

      {view === 'week' ? (
        <div className="card">
          <div className="week-grid">
            <table>
              <thead>
                <tr>
                  <th>Project / Task</th>
                  {weekDates.map(d => (
                    <th key={d}>{formatDisplay(d)}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {weekRows.map(row => {
                  const rowTotal = weekDates.reduce((s, d) => s + (row.entries[d] ? parseFloat(row.entries[d].hours) : 0), 0)
                  return (
                    <tr key={`${row.project_id}-${row.task_id}`}>
                      <td>
                        <strong>{row.client_name}</strong> - {row.project_name}
                        <br /><span style={{ color: '#888', fontSize: '12px' }}>{row.task_name}</span>
                      </td>
                      {weekDates.map(d => (
                        <td key={d}>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={row.entries[d] ? row.entries[d].hours : ''}
                            placeholder="0"
                            onChange={e => handleWeekCellChange(row.project_id, row.task_id, d, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="week-total">{rowTotal.toFixed(2)}</td>
                    </tr>
                  )
                })}
                {addingRow ? (
                  <tr>
                    <td>
                      <select value={newRow.project_id} onChange={e => setNewRow({ ...newRow, project_id: e.target.value, task_id: '' })} style={{ marginBottom: 4, width: '100%' }}>
                        <option value="">Select project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.client_name} - {p.name}</option>)}
                      </select>
                      <select value={newRow.task_id} onChange={e => setNewRow({ ...newRow, task_id: e.target.value })} style={{ width: '100%' }}>
                        <option value="">Select task...</option>
                        {getTasksForProject(newRow.project_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td colSpan={7}></td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={addWeekRow}>Add</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setAddingRow(false)} style={{ marginLeft: 4 }}>Cancel</button>
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td colSpan={9}>
                    <div className="add-row">
                      <button onClick={() => setAddingRow(true)}>+ Add Row</button>
                    </div>
                  </td>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td>Daily Total</td>
                  {weekDates.map(d => {
                    const total = entries.filter(e => e.date === d).reduce((s, e) => s + e.hours, 0)
                    return <td key={d} style={{ textAlign: 'center' }}>{total > 0 ? total.toFixed(2) : ''}</td>
                  })}
                  <td className="week-total">
                    {entries.reduce((s, e) => s + e.hours, 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="day-header">
            <h3>{formatDisplay(formatDate(currentDate))}</h3>
            <span className="day-total">Total: {dayTotal.toFixed(2)} hours</span>
          </div>
          <div className="card">
            {dayEntries.map(entry => (
              <div key={entry.id} className="day-entry">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Project</label>
                  <span>{entry.client_name} - {entry.project_name}</span>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Task</label>
                  <span>{entry.task_name}</span>
                </div>
                <div className="form-group" style={{ width: 80 }}>
                  <label>Hours</label>
                  <span>{entry.hours}</span>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Notes</label>
                  <span>{entry.notes}</span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => deleteDayEntry(entry.id)}>Delete</button>
              </div>
            ))}
            <div className="day-entry" style={{ background: '#fafafa', borderRadius: 6, marginTop: 8 }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Project</label>
                <select value={newEntry.project_id} onChange={e => setNewEntry({ ...newEntry, project_id: e.target.value, task_id: '' })}>
                  <option value="">Select...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.client_name} - {p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Task</label>
                <select value={newEntry.task_id} onChange={e => setNewEntry({ ...newEntry, task_id: e.target.value })}>
                  <option value="">Select...</option>
                  {getTasksForProject(newEntry.project_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ width: 80 }}>
                <label>Hours</label>
                <input type="number" step="0.25" value={newEntry.hours} onChange={e => setNewEntry({ ...newEntry, hours: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Notes</label>
                <input type="text" value={newEntry.notes} onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })} />
              </div>
              <button className="btn btn-primary" onClick={addDayEntry}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

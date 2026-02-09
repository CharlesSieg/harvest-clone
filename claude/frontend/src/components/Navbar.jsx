import { NavLink } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">Harvest Clone</div>
      <div className="navbar-links">
        <NavLink to="/time" className={({ isActive }) => isActive ? 'active' : ''}>Time</NavLink>
        <NavLink to="/expenses" className={({ isActive }) => isActive ? 'active' : ''}>Expenses</NavLink>
        <NavLink to="/projects" className={({ isActive }) => isActive ? 'active' : ''}>Projects</NavLink>
        <NavLink to="/reports/invoices" className={({ isActive }) => isActive ? 'active' : ''}>Reports</NavLink>
        <NavLink to="/invoices" className={({ isActive }) => isActive ? 'active' : ''}>Invoices</NavLink>
        <NavLink to="/manage/clients" className={({ isActive }) => isActive ? 'active' : ''}>Manage</NavLink>
        <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>Settings</NavLink>
      </div>
    </nav>
  )
}

export default Navbar

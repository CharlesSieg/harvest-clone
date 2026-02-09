import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import TimePage from './pages/TimePage'
import ExpensesPage from './pages/ExpensesPage'
import ProjectsPage from './pages/ProjectsPage'
import InvoicesPage from './pages/InvoicesPage'
import InvoiceDetail from './pages/InvoiceDetail'
import InvoiceCreate from './pages/InvoiceCreate'
import ReportsPage from './pages/ReportsPage'
import ManagePage from './pages/ManagePage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/time" replace />} />
          <Route path="/time" element={<TimePage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/new" element={<InvoiceCreate />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/reports/*" element={<ReportsPage />} />
          <Route path="/manage/*" element={<ManagePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

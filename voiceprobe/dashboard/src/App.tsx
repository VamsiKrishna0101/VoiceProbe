import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import PageShell from './components/layout/PageShell'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import NewTest from './pages/NewTest'
import Report from './pages/Report'
import ABComparison from './pages/ABComparison'
import Security from './pages/Security'
import TestStatus from './pages/TestStatus'
import Settings from './pages/Settings'
import AllReports from './pages/AllReports'
import Regression from './pages/Regression'

export default function App() {
  return (
    <Router>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--vp-bg)' }}>
        <Sidebar />
        <div style={{ flex: 1, marginLeft: '200px', display: 'flex', flexDirection: 'column' }}>
          <PageShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new-test" element={<NewTest />} />
              <Route path="/status/:runId" element={<TestStatus />} />
              <Route path="/report/:runId" element={<Report />} />
              <Route path="/ab-compare" element={<ABComparison />} />
              <Route path="/security" element={<Security />} />
              <Route path="/all-reports" element={<AllReports />} />
              <Route path="/regression" element={<Regression />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </PageShell>
        </div>
      </div>
    </Router>
  )
}
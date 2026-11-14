import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ItemProvider } from './contexts/ItemContext'
import AdminView from './views/AdminView'
import AuthView from './views/AuthView'
import DashboardView from './views/DashboardView'
import FoundItemsView from './views/FoundItemsView'
import LostItemsView from './views/LostItemsView'
import ReportItemView from './views/ReportItemView'
import './App.css'

function AppRoutes() {
  const { pathname } = useLocation()
  const { user, loading } = useAuth()
  const isAuthRoute = pathname === '/'

  if (loading) {
    return <main className="auth-loading" role="status">Loading your account…</main>
  }

  if (isAuthRoute) {
    return user
      ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
      : <AuthView />
  }

  if (!user) return <Navigate to="/" replace />
  if (pathname === '/admin' && user.role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/lost" element={<LostItemsView />} />
        <Route path="/found" element={<FoundItemsView />} />
        <Route path="/report" element={<ReportItemView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ItemProvider>
        <AppRoutes />
      </ItemProvider>
    </AuthProvider>
  )
}

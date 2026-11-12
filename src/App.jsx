import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import { ItemProvider } from './contexts/ItemContext'
import AuthView from './views/AuthView'
import DashboardView from './views/DashboardView'
import FoundItemsView from './views/FoundItemsView'
import LostItemsView from './views/LostItemsView'
import ReportItemView from './views/ReportItemView'
import './App.css'

function AppRoutes() {
  const { pathname } = useLocation()
  const isAuthRoute = pathname === '/'

  return (
    <>
      {!isAuthRoute && <Navbar />}
      <Routes>
        <Route path="/" element={<AuthView />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/lost" element={<LostItemsView />} />
        <Route path="/found" element={<FoundItemsView />} />
        <Route path="/report" element={<ReportItemView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ItemProvider>
      <AppRoutes />
    </ItemProvider>
  )
}

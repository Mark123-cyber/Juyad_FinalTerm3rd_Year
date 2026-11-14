import { Link, useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, Search, BellRing, PackageOpen, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const USER_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lost', label: 'Lost Items', icon: Search },
  { to: '/found', label: 'Found Items', icon: PackageOpen },
  { to: '/report', label: 'Report Item', icon: BellRing },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [error, setError] = useState('')
  const navItems = user?.role === 'admin'
    ? [...USER_NAV_ITEMS, { to: '/admin', label: 'Admin', icon: ShieldCheck }]
    : USER_NAV_ITEMS

  const handleLogout = async () => {
    setError('')
    try {
      await signOut()
    } catch (logoutError) {
      setError(logoutError.message)
      return
    }
    navigate('/')
  }

  return (
    <header className="site-header">
      <div className="navbar-inner">
        <Link to="/dashboard" className="brand-link">
          <div className="brand-icon">
            <BellRing size={19} />
          </div>
          <div className="brand-copy">
            <span>SLSU</span>
            <small>Campus Lost &amp; Found</small>
          </div>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="nav-link"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <span className="account-name">{user?.fullName}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="logout-button"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
      {error && <p className="nav-error" role="alert">{error}</p>}
    </header>
  )
}
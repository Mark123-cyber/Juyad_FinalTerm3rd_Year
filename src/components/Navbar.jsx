import { Link, useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, Search, BellRing, PackageOpen } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lost', label: 'Lost Items', icon: Search },
  { to: '/found', label: 'Found Items', icon: PackageOpen },
  { to: '/report', label: 'Report Item', icon: BellRing },
]

export default function Navbar() {
  const navigate = useNavigate()

  const handleLogout = () => {
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
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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

        <button
          type="button"
          onClick={handleLogout}
          className="logout-button"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>

    </header>
  )
}
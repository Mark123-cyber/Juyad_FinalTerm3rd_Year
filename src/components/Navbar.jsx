import { Link, useNavigate } from 'react-router-dom'
import { Bell, LogOut, LayoutDashboard, Search, BellRing, PackageOpen, ShieldCheck, ClipboardCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useItems } from '../contexts/ItemContext'
import { apiRequest } from '../lib/api'

const COMMON_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lost', label: 'Lost Items', icon: Search },
  { to: '/found', label: 'Found Items', icon: PackageOpen },
  { to: '/report', label: 'Report Item', icon: BellRing },
]

const STUDENT_NAV_ITEMS = [
  ...COMMON_NAV_ITEMS,
  { to: '/claims', label: 'My Claims', icon: ClipboardCheck },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { refreshItems } = useItems()
  const [error, setError] = useState('')
  const [notifications, setNotifications] = useState([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [notificationError, setNotificationError] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const isStudent = user?.role === 'user'
  const unreadCount = unreadNotificationCount
  const navItems = user?.role === 'admin'
    ? [...COMMON_NAV_ITEMS, { to: '/admin', label: 'Admin', icon: ShieldCheck }]
    : STUDENT_NAV_ITEMS

  useEffect(() => {
    if (!isStudent) return undefined

    let active = true
    const refreshNotifications = async () => {
      try {
        const result = await apiRequest('/api/notifications')
        if (active) {
          setNotifications(result.notifications)
          setUnreadNotificationCount(result.unreadCount)
          setNotificationError('')
        }
      } catch (loadError) {
        if (active) setNotificationError(loadError.message)
      }
    }

    void refreshNotifications()
    const intervalId = window.setInterval(refreshNotifications, 30000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [isStudent, user?.id])

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

  const handleNotificationClick = async (notification) => {
    if (!notification.readAt) {
      try {
        const result = await apiRequest(`/api/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH' })
        setNotifications((current) => current.map((entry) => (
          entry.id === notification.id ? { ...entry, readAt: result.readAt } : entry
        )))
        setUnreadNotificationCount((count) => Math.max(0, count - 1))
        setNotificationError('')
      } catch (readError) {
        setNotificationError(readError.message)
      }
    }
    try {
      await refreshItems()
    } catch (refreshError) {
      setNotificationError(refreshError.message)
    }
    setNotificationsOpen(false)
    navigate(notification.itemType === 'lost' ? '/lost' : '/found')
  }

  const markAllNotificationsRead = async () => {
    try {
      const result = await apiRequest('/api/notifications/read-all', { method: 'PATCH' })
      setNotifications((current) => current.map((notification) => (
        notification.readAt ? notification : { ...notification, readAt: result.readAt }
      )))
      setUnreadNotificationCount(0)
      setNotificationError('')
    } catch (readError) {
      setNotificationError(readError.message)
    }
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

        {isStudent && (
          <div className="notification-menu">
            <button
              type="button"
              className="notification-button"
              aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={18} aria-hidden="true" />
              {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <section className="notification-popover" role="dialog" aria-label="Student notifications">
                <header className="notification-heading">
                  <div>
                    <h2>Notifications</h2>
                    <p>{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</p>
                  </div>
                  <button type="button" className="notification-mark-read" onClick={markAllNotificationsRead} disabled={!unreadCount}>
                    Mark all read
                  </button>
                </header>
                {notificationError && <p className="notification-error" role="alert">{notificationError}</p>}
                {notifications.length ? (
                  <div className="notification-list">
                    {notifications.slice(0, 8).map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className={`notification-item${notification.readAt ? '' : ' unread'}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <span className="notification-item-top">
                          <span className={`notification-type ${notification.eventType}`}>
                            {notification.eventType === 'claimed' ? 'Claim update' : 'New report'}
                          </span>
                          {!notification.readAt && <span className="notification-unread-dot" aria-label="Unread" />}
                        </span>
                        <span className="notification-message">{notification.message}</span>
                        <time dateTime={notification.createdAt}>
                          {new Date(notification.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </time>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="notification-empty">New reports and claim updates for your campus will appear here.</p>
                )}
              </section>
            )}
          </div>
        )}

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
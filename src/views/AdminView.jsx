import { useEffect, useState } from 'react'
import { BellRing, Building2, CalendarDays, CirclePlus, PackageCheck, Pencil, Search, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useItems } from '../contexts/ItemContext'
import { apiRequest } from '../lib/api'

const EMPTY_USER = {
  fullName: '',
  studentId: '',
  email: '',
  campus: '',
  role: 'user',
  password: '',
}

export default function AdminView() {
  const { items, loading: itemsLoading, error: itemsError, updateItem, deleteItem } = useItems()
  const [section, setSection] = useState('reports')
  const [users, setUsers] = useState([])
  const [campuses, setCampuses] = useState([])
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [userForm, setUserForm] = useState(null)
  const [reportForm, setReportForm] = useState(null)
  const [campusName, setCampusName] = useState('')
  const [reportQuery, setReportQuery] = useState('')
  const [reportType, setReportType] = useState('all')
  const [reportStatus, setReportStatus] = useState('all')

  const lostCount = items.filter((item) => item.type === 'lost').length
  const foundCount = items.filter((item) => item.type === 'found').length
  const openCount = items.filter((item) => item.status !== 'claimed').length
  const filteredReports = items.filter((item) => {
    const matchesType = reportType === 'all' || item.type === reportType
    const matchesStatus = reportStatus === 'all' || item.status === reportStatus
    const searchableText = `${item.title} ${item.description} ${item.location} ${item.reporter} ${item.campus}`.toLowerCase()
    return matchesType && matchesStatus && searchableText.includes(reportQuery.trim().toLowerCase())
  })

  const loadAdminData = async () => {
    setError('')
    const [nextUsers, nextCampuses, notificationSettings] = await Promise.all([
      apiRequest('/api/admin/users'),
      apiRequest('/api/campuses'),
      apiRequest('/api/admin/notification-settings'),
    ])
    setUsers(nextUsers)
    setCampuses(nextCampuses)
    setEmailNotificationsEnabled(notificationSettings.emailNotificationsEnabled)
  }

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest('/api/admin/users'),
      apiRequest('/api/campuses'),
      apiRequest('/api/admin/notification-settings'),
    ])
      .then(([nextUsers, nextCampuses, notificationSettings]) => {
        if (active) {
          setUsers(nextUsers)
          setCampuses(nextCampuses)
          setEmailNotificationsEnabled(notificationSettings.emailNotificationsEnabled)
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const showError = (actionError) => {
    setNotice('')
    setError(actionError.message)
  }

  const handleUserSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      if (userForm.id) {
        await apiRequest(`/api/admin/users/${encodeURIComponent(userForm.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(userForm),
        })
        setNotice('User account updated.')
      } else {
        await apiRequest('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(userForm),
        })
        setNotice('User account added.')
      }
      setUserForm(null)
      await loadAdminData()
    } catch (actionError) {
      showError(actionError)
    }
  }

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Remove the account for ${user.fullName}?`)) return
    setError('')
    setNotice('')
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id))
      setNotice('User account removed.')
    } catch (actionError) {
      showError(actionError)
    }
  }

  const handleReportSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      await updateItem(reportForm.id, reportForm)
      setReportForm(null)
      setNotice('Report updated.')
    } catch (actionError) {
      showError(actionError)
    }
  }

  const handleDeleteReport = async (item) => {
    if (!window.confirm(`Remove the report for “${item.title}”?`)) return
    setError('')
    setNotice('')
    try {
      await deleteItem(item.id)
      setNotice('Report removed.')
    } catch (actionError) {
      showError(actionError)
    }
  }

  const handleCampusSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      const campus = await apiRequest('/api/admin/campuses', {
        method: 'POST',
        body: JSON.stringify({ name: campusName }),
      })
      setCampuses((currentCampuses) => [...currentCampuses, campus.name])
      setCampusName('')
      setNotice('Campus added to sign-up choices.')
    } catch (actionError) {
      showError(actionError)
    }
  }

  const handleDeleteCampus = async (campus) => {
    if (!window.confirm(`Remove ${campus} from the campus choices?`)) return
    setError('')
    setNotice('')
    try {
      await apiRequest(`/api/admin/campuses/${encodeURIComponent(campus)}`, { method: 'DELETE' })
      setCampuses((currentCampuses) => currentCampuses.filter((currentCampus) => currentCampus !== campus))
      setNotice('Campus removed from sign-up choices.')
    } catch (actionError) {
      showError(actionError)
    }
  }

  const beginEditUser = (user) => {
    setUserForm({
      id: user.id,
      fullName: user.fullName,
      studentId: user.studentId,
      email: user.email,
      campus: user.campus,
      role: user.role,
      password: '',
      isFixedAdmin: user.isFixedAdmin,
    })
    setError('')
    setNotice('')
  }

  const beginEditReport = (item) => {
    setReportForm({ ...item })
    setError('')
    setNotice('')
  }

  return (
    <main className="page-shell admin-page">
      <section className="page-header stacked">
        <div>
          <p className="eyebrow">SLSU LOST &amp; FOUND · OPERATIONS</p>
          <h1>Administrator dashboard</h1>
          <p className="subtle-copy">Review campus reports, manage student and staff access, and maintain campus choices.</p>
        </div>
      </section>

      <section className="stats-grid five-columns admin-overview-stats" aria-label="System overview">
        <article className="stat-card">
          <div className="stat-icon"><CalendarDays size={20} aria-hidden="true" /></div>
          <div><span className="label">All reports</span><strong>{itemsLoading ? '—' : items.length}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><BellRing size={20} aria-hidden="true" /></div>
          <div><span className="label">Needs follow-up</span><strong>{itemsLoading ? '—' : openCount}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><Search size={20} aria-hidden="true" /></div>
          <div><span className="label">Lost reports</span><strong>{itemsLoading ? '—' : lostCount}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><PackageCheck size={20} aria-hidden="true" /></div>
          <div><span className="label">Found reports</span><strong>{itemsLoading ? '—' : foundCount}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><Users size={20} aria-hidden="true" /></div>
          <div><span className="label">Accounts</span><strong>{loading ? '—' : users.length}</strong></div>
        </article>
      </section>

      {emailNotificationsEnabled === false && (
        <p className="admin-email-notice" role="status">
          In-app alerts are active. Email alerts are not configured; add SMTP settings to the server&apos;s .env file to enable them.
        </p>
      )}

      <section className="admin-panel">
        <div className="admin-tabs" role="tablist" aria-label="Administration sections">
          <button type="button" role="tab" aria-selected={section === 'reports'} className={section === 'reports' ? 'admin-tab active' : 'admin-tab'} onClick={() => setSection('reports')}>
            <ShieldCheck size={16} /> Reports <span>{items.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={section === 'users'} className={section === 'users' ? 'admin-tab active' : 'admin-tab'} onClick={() => setSection('users')}>
            <Users size={16} /> Users <span>{users.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={section === 'campuses'} className={section === 'campuses' ? 'admin-tab active' : 'admin-tab'} onClick={() => setSection('campuses')}>
            <Building2 size={16} /> Campuses <span>{campuses.length}</span>
          </button>
        </div>

        {(error || notice) && <p className={error ? 'admin-message error' : 'admin-message success'} role={error ? 'alert' : 'status'}>{error || notice}</p>}
        {loading && <p className="empty-inline">Loading administrator data…</p>}

        {!loading && section === 'reports' && (
          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <h2>Campus item reports</h2>
                <p>Review, correct, or remove reports submitted to the lost and found system.</p>
              </div>
            </div>
            {reportForm && (
              <form className="report-form admin-edit-form" onSubmit={handleReportSubmit}>
                <div className="admin-form-grid">
                  <label>Title<input value={reportForm.title} onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })} required /></label>
                  <label>Reporter<input value={reportForm.reporter} onChange={(event) => setReportForm({ ...reportForm, reporter: event.target.value })} required /></label>
                  <label className="admin-wide-field">Description<textarea value={reportForm.description} onChange={(event) => setReportForm({ ...reportForm, description: event.target.value })} required /></label>
                  <label>Location<input value={reportForm.location} onChange={(event) => setReportForm({ ...reportForm, location: event.target.value })} required /></label>
                  <label>Type<select value={reportForm.type} onChange={(event) => setReportForm({ ...reportForm, type: event.target.value })}><option value="lost">Lost</option><option value="found">Found</option></select></label>
                  <label>Status<select value={reportForm.status || 'open'} onChange={(event) => setReportForm({ ...reportForm, status: event.target.value })}><option value="open">Open</option><option value="claimed">Claimed / resolved</option></select></label>
                  <label>Date<input type="date" value={reportForm.date} onChange={(event) => setReportForm({ ...reportForm, date: event.target.value })} required /></label>
                  <p className="field-hint admin-wide-field">Only mark an item claimed after staff verifies that it has been returned. Students at this campus will be notified.</p>
                </div>
                <div className="admin-form-actions">
                  <button type="button" className="secondary-btn" onClick={() => setReportForm(null)}>Cancel</button>
                  <button type="submit" className="primary-btn">Save report</button>
                </div>
              </form>
            )}
            <div className="admin-report-filters">
              <label className="admin-report-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search reports</span>
                <input
                  type="search"
                  value={reportQuery}
                  onChange={(event) => setReportQuery(event.target.value)}
                  placeholder="Search item, reporter, or location"
                />
              </label>
              <label className="admin-report-type">
                <span>Report type</span>
                <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
                  <option value="all">All types</option>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </label>
              <label className="admin-report-type">
                <span>Follow-up status</span>
                <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="open">Needs follow-up</option>
                  <option value="claimed">Claimed / resolved</option>
                </select>
              </label>
              <p className="admin-filter-count" aria-live="polite">
                {itemsLoading ? 'Loading reports…' : `${filteredReports.length} ${filteredReports.length === 1 ? 'report' : 'reports'}`}
              </p>
            </div>
            {itemsError ? <p className="form-error" role="alert">{itemsError}</p> : itemsLoading ? <p className="empty-inline">Loading reports…</p> : filteredReports.length ? (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Item</th><th>Reporter</th><th>Campus</th><th>Type</th><th>Status</th><th>Date reported</th><th>Actions</th></tr></thead>
                  <tbody>{filteredReports.map((item) => (
                    <tr key={item.id}>
                      <td><span className="item-title">{item.title}</span><small>{item.location}</small></td>
                      <td>{item.reporter}</td>
                      <td>{item.campus}</td>
                      <td><span className={`pill ${item.type === 'lost' ? 'warning' : 'success'}`}>{item.type}</span></td>
                      <td><span className={`item-status ${item.status === 'claimed' ? 'claimed' : 'open'}`}>{item.status === 'claimed' ? 'Claimed / resolved' : 'Open'}</span></td>
                      <td>{item.date}</td>
                      <td><div className="admin-row-actions">
                        <button type="button" className="admin-icon-btn" onClick={() => beginEditReport(item)} aria-label={`Edit ${item.title}`}><Pencil size={15} /></button>
                        <button type="button" className="admin-icon-btn danger" onClick={() => handleDeleteReport(item)} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : items.length ? (
              <div className="admin-filter-empty">
                <p>No reports match your search and type filter.</p>
                <button type="button" className="secondary-btn" onClick={() => { setReportQuery(''); setReportType('all'); setReportStatus('all') }}>
                  Clear filters
                </button>
              </div>
            ) : <p className="empty-inline">No reports to manage.</p>}
          </section>
        )}

        {!loading && section === 'users' && (
          <section className="admin-section">
            <div className="admin-section-heading">
              <div><h2>User accounts</h2><p>Add accounts, change roles, or reset a password.</p></div>
              {!userForm && <button type="button" className="primary-btn compact" onClick={() => { setUserForm({ ...EMPTY_USER }); setError('') }}><CirclePlus size={16} /> Add user</button>}
            </div>
            {userForm && (
              <form className="report-form admin-edit-form" onSubmit={handleUserSubmit}>
                <div className="admin-form-grid">
                  <label>Full name<input value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} required /></label>
                  <label>Student ID<input value={userForm.studentId} onChange={(event) => setUserForm({ ...userForm, studentId: event.target.value })} required disabled={userForm.isFixedAdmin} minLength={3} maxLength={32} pattern="[A-Za-z0-9](?:[A-Za-z0-9]|-){2,31}" /></label>
                  <label>Email (optional; needed for email alerts)<input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} disabled={userForm.isFixedAdmin} maxLength={120} /></label>
                  <label>Campus<select value={userForm.campus} onChange={(event) => setUserForm({ ...userForm, campus: event.target.value })} required>
                    <option value="" disabled>Select campus</option>
                    {campuses.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
                  </select></label>
                  <label>Role<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })} disabled={userForm.isFixedAdmin}>
                    <option value="user">User</option><option value="admin">Administrator</option>
                  </select></label>
                  <label className="admin-wide-field">{userForm.id ? 'New password (leave blank to keep current)' : 'Temporary password'}
                    <input type="password" autoComplete="new-password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} required={!userForm.id} minLength={8} maxLength={128} disabled={userForm.isFixedAdmin} />
                  </label>
                </div>
                <div className="admin-form-actions">
                  <button type="button" className="secondary-btn" onClick={() => setUserForm(null)}>Cancel</button>
                  <button type="submit" className="primary-btn">{userForm.id ? 'Save changes' : 'Create account'}</button>
                </div>
              </form>
            )}
            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Student ID</th><th>Email / login</th><th>Campus</th><th>Role</th><th>Actions</th></tr></thead>
                <tbody>{users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}{user.isFixedAdmin && <small className="fixed-admin-tag">Fixed account</small>}</td>
                    <td>{user.studentId || '—'}</td>
                    <td>{user.email || user.login}</td>
                    <td>{user.campus}</td>
                    <td><span className={`role-badge ${user.role}`}>{user.role === 'admin' ? 'Administrator' : 'User'}</span></td>
                    <td><div className="admin-row-actions">
                      <button type="button" className="admin-icon-btn" onClick={() => beginEditUser(user)} aria-label={`Edit ${user.fullName}`}><Pencil size={15} /></button>
                      {!user.isFixedAdmin && <button type="button" className="admin-icon-btn danger" onClick={() => handleDeleteUser(user)} aria-label={`Delete ${user.fullName}`}><Trash2 size={15} /></button>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && section === 'campuses' && (
          <section className="admin-section">
            <div className="admin-section-heading">
              <div><h2>Sign-up campus choices</h2><p>Changes here are reflected in the account sign-up dropdown.</p></div>
            </div>
            <form className="campus-add-form" onSubmit={handleCampusSubmit}>
              <label className="sr-only" htmlFor="new-campus">New campus name</label>
              <input id="new-campus" value={campusName} onChange={(event) => setCampusName(event.target.value)} placeholder="Enter campus name" maxLength={100} required />
              <button type="submit" className="primary-btn compact"><CirclePlus size={16} /> Add campus</button>
            </form>
            <ul className="campus-list">
              {campuses.map((campus) => (
                <li key={campus}><span><Building2 size={17} />{campus}</span>
                  <button type="button" className="admin-icon-btn danger" onClick={() => handleDeleteCampus(campus)} aria-label={`Remove ${campus}`}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  )
}

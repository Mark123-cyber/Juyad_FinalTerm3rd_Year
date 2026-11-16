import { Building2, CalendarDays, CirclePlus, MapPin, PackageCheck, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useItems } from '../contexts/ItemContext'

export default function DashboardView() {
  const { user } = useAuth()
  const { items, loading, error } = useItems()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const lostCount = items.filter((item) => item.type === 'lost').length
  const foundCount = items.filter((item) => item.type === 'found').length
  const matchingItems = items.filter((item) => {
    const matchesType = typeFilter === 'all' || item.type === typeFilter
    const searchableText = `${item.title} ${item.description} ${item.location} ${item.campus}`.toLowerCase()
    return matchesType && searchableText.includes(query.trim().toLowerCase())
  })
  const recentItems = matchingItems.slice(0, 6)
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'there'

  return (
    <main className="page-shell dashboard-page">
      <section className="page-header dashboard-page-header">
        <div>
          <p className="eyebrow">{user?.campus ? `${user.campus} campus` : 'SLSU campus portal'}</p>
          <h1>Welcome, {firstName}</h1>
          <p className="subtle-copy">Search campus lost and found reports or share a report to help reunite someone with their item.</p>
        </div>
        <Link to="/report" className="primary-btn compact">
          <CirclePlus size={18} />
          Report item
        </Link>
      </section>

      <section className="stats-grid three-columns dashboard-stats" aria-label="Campus report totals">
        <article className="stat-card">
          <div className="stat-icon"><Search size={20} aria-hidden="true" /></div>
          <div><span className="label">Lost reports</span><strong>{loading ? '—' : lostCount}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><PackageCheck size={20} aria-hidden="true" /></div>
          <div><span className="label">Found reports</span><strong>{loading ? '—' : foundCount}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><CalendarDays size={20} aria-hidden="true" /></div>
          <div><span className="label">All campus reports</span><strong>{loading ? '—' : items.length}</strong></div>
        </article>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="panel dashboard-reports">
        <div className="panel-header spaced">
          <div>
            <p className="panel-tag">Campus lost &amp; found</p>
            <h2>Browse item reports</h2>
            <p className="dashboard-results" aria-live="polite">
              {loading ? 'Loading campus reports…' : `${matchingItems.length} ${matchingItems.length === 1 ? 'report' : 'reports'} found`}
            </p>
          </div>
          <div className="dashboard-links">
            <Link to="/lost">Lost items</Link>
            <Link to="/found">Found items</Link>
          </div>
        </div>

        <div className="dashboard-report-tools">
          <label className="dashboard-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search reports</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search item, description, or location"
            />
          </label>
          <div className="dashboard-filter-buttons" role="group" aria-label="Filter reports by type">
            {['all', 'lost', 'found'].map((type) => (
              <button
                key={type}
                type="button"
                className={typeFilter === type ? 'dashboard-filter-button active' : 'dashboard-filter-button'}
                aria-pressed={typeFilter === type}
                onClick={() => setTypeFilter(type)}
              >
                {type === 'all' ? 'All reports' : `${type[0].toUpperCase()}${type.slice(1)}`}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p className="empty-inline">Loading campus reports…</p> : recentItems.length ? (
          <>
            <div className="dashboard-report-grid">
              {recentItems.map((item) => (
                <article key={item.id} className="dashboard-report-card">
                  <div className="card-top">
                    <span className={`pill ${item.type === 'lost' ? 'warning' : 'success'}`}>{item.type}</span>
                    <span className="dashboard-report-badges">
                      <span className={`item-status ${item.status === 'claimed' ? 'claimed' : 'open'}`}>
                        {item.status === 'claimed' ? 'Claimed / resolved' : 'Open'}
                      </span>
                      <time className="date-badge" dateTime={item.date}>
                        <CalendarDays size={14} aria-hidden="true" />
                        {item.date}
                      </time>
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="dashboard-report-description">{item.description}</p>
                  <p className="dashboard-campus">
                    <Building2 size={15} aria-hidden="true" />
                    {item.campus} campus
                  </p>
                  <p className="item-location">
                    <MapPin size={16} aria-hidden="true" />
                    {item.location}
                  </p>
                  <Link className="dashboard-report-link" to={item.type === 'lost' ? '/lost' : '/found'}>
                    Browse {item.type} reports
                  </Link>
                </article>
              ))}
            </div>
            {matchingItems.length > recentItems.length && (
              <p className="dashboard-more">
                Showing the latest {recentItems.length} of {matchingItems.length} matching reports.
              </p>
            )}
          </>
        ) : (
          <div className="dashboard-empty">
            <PackageCheck size={26} aria-hidden="true" />
            <h3>{items.length ? 'No matching reports' : 'No campus reports yet'}</h3>
            <p>{items.length ? 'Try another keyword or report type.' : 'Be the first to report a lost or found item on campus.'}</p>
            {items.length ? (
              <button type="button" className="secondary-btn" onClick={() => { setQuery(''); setTypeFilter('all') }}>
                Clear filters
              </button>
            ) : (
              <Link to="/report" className="primary-btn compact">Create the first report</Link>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

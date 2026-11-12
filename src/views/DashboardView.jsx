import { CalendarDays, CirclePlus, PackageCheck, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useItems } from '../contexts/ItemContext'

export default function DashboardView() {
  const { items } = useItems()
  const lostCount = items.filter((item) => item.type === 'lost').length
  const foundCount = items.filter((item) => item.type === 'found').length

  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Campus dashboard</h1>
          <p className="subtle-copy">Browse reports and help return items to their owners.</p>
        </div>
        <Link to="/report" className="primary-btn compact">
          <CirclePlus size={18} />
          Report item
        </Link>
      </section>

      <section className="stats-grid three-columns" aria-label="Item totals">
        <article className="stat-card">
          <div className="stat-icon"><Search size={20} /></div>
          <div><span className="label">Lost items</span><strong>{lostCount}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><PackageCheck size={20} /></div>
          <div><span className="label">Found items</span><strong>{foundCount}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><CalendarDays size={20} /></div>
          <div><span className="label">Total reports</span><strong>{items.length}</strong></div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header spaced">
          <div>
            <p className="panel-tag">Latest activity</p>
            <h2>Recent item reports</h2>
          </div>
          <div className="dashboard-links">
            <Link to="/lost">Lost items</Link>
            <Link to="/found">Found items</Link>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Item</th><th>Type</th><th>Location</th><th>Date</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="item-title">{item.title}</td>
                    <td><span className={`pill ${item.type === 'lost' ? 'warning' : 'success'}`}>{item.type}</span></td>
                    <td>{item.location}</td>
                    <td>{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-inline">No reports yet. Submit an item to get started.</p>
        )}
      </section>
    </main>
  )
}

import { Building2, CalendarDays, MapPin, PackageOpen } from 'lucide-react'

export default function ItemListView({ title, description, items, loading, error, extraError, renderItemAction }) {
  return (
    <main className="page-shell">
      <section className="page-header stacked">
        <div>
          <p className="eyebrow">Campus reports</p>
          <h1>{title}</h1>
          <p className="subtle-copy">{description}</p>
        </div>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {extraError && <p className="form-error" role="alert">{extraError}</p>}
      {loading ? (
        <p className="empty-inline">Loading reports…</p>
      ) : items.length > 0 ? (
        <section className="item-grid" aria-label={title}>
          {items.map((item) => (
            <article key={item.id} className="item-card">
              <div className="card-top">
                <span className={`pill ${item.type === 'lost' ? 'warning' : 'success'}`}>
                  {item.type}
                </span>
                <span className="item-list-meta">
                  {item.reviewStatus === 'pending' ? (
                    <span className="item-status pending">Pending staff review</span>
                  ) : item.reviewStatus === 'rejected' ? (
                    <span className="item-status rejected">Not approved</span>
                  ) : (
                    <span className={`item-status ${item.status === 'claimed' ? 'claimed' : 'open'}`}>
                      {item.status === 'claimed' ? 'Claimed / resolved' : 'Open'}
                    </span>
                  )}
                  <time className="date-badge" dateTime={item.date}>
                    <CalendarDays size={14} aria-hidden="true" />
                    {item.date}
                  </time>
                </span>
              </div>
              <h2>{item.title}</h2>
              <p className="description">{item.description}</p>
              <p className="item-location">
                <Building2 size={16} aria-hidden="true" />
                {item.campus} campus
              </p>
              <p className="item-location">
                <MapPin size={16} aria-hidden="true" />
                {item.location}
              </p>
              {renderItemAction?.(item)}
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <PackageOpen size={28} aria-hidden="true" />
          <h2>No {title.toLowerCase()} yet</h2>
          <p>Reports will appear here when an item is submitted.</p>
        </section>
      )}
    </main>
  )
}

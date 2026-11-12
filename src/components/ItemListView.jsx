import { CalendarDays, MapPin, PackageOpen } from 'lucide-react'

export default function ItemListView({ title, description, items }) {
  return (
    <main className="page-shell">
      <section className="page-header stacked">
        <div>
          <p className="eyebrow">Campus reports</p>
          <h1>{title}</h1>
          <p className="subtle-copy">{description}</p>
        </div>
      </section>

      {items.length > 0 ? (
        <section className="item-grid" aria-label={title}>
          {items.map((item) => (
            <article key={item.id} className="item-card">
              <div className="card-top">
                <span className={`pill ${item.type === 'lost' ? 'warning' : 'success'}`}>
                  {item.type}
                </span>
                <span className="date-badge">
                  <CalendarDays size={14} />
                  {item.date}
                </span>
              </div>
              <h2>{item.title}</h2>
              <p className="description">{item.description}</p>
              <p className="item-location">
                <MapPin size={16} aria-hidden="true" />
                {item.location}
              </p>
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

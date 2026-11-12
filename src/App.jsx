import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  MapPin,
  Package,
  PackageSearch,
  PlusCircle,
  Search,
  ShieldCheck,
} from 'lucide-react'
import Navbar from './components/Navbar'
import { ItemProvider, useItems } from './contexts/ItemContext'
import './App.css'

const initialForm = {
  title: '',
  type: 'lost',
  location: '',
  reporter: '',
  description: '',
}

function App() {
  return (
    <ItemProvider>
      <AppRoutes />
    </ItemProvider>
  )
}

function AppRoutes() {
  const location = useLocation()
  const showNavbar = location.pathname !== '/'

  return (
    <>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/lost" element={<LostItemsPage />} />
        <Route path="/found" element={<FoundItemsPage />} />
        <Route path="/report" element={<ReportItemPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">SLSU Campus Service</span>
          <h1>Find what&apos;s lost. Return what&apos;s found.</h1>
          <p>
            Reconnect students, faculty, and staff with a faster way to report,
            search, and recover missing items across campus.
          </p>
          <div className="cta-row">
            <button type="button" className="primary-btn" onClick={() => navigate('/dashboard')}>
              Open dashboard
              <ArrowRight size={18} />
            </button>
            <Link to="/report" className="secondary-btn">
              Report an item
            </Link>
          </div>
          <div className="mini-stats">
            <div>
              <strong>1.2k+</strong>
              <span>claims processed</span>
            </div>
            <div>
              <strong>94%</strong>
              <span>recovery rate</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>campus coverage</span>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-header">
            <div>
              <p className="panel-tag">Live campus activity</p>
              <h2>Today&apos;s recovery board</h2>
            </div>
            <span className="pill success">Active</span>
          </div>

          <div className="activity-list">
            <div className="activity-item">
              <div className="icon-wrap blue">
                <PackageSearch size={18} />
              </div>
              <div>
                <h3>Black Samsung Galaxy S21</h3>
                <p>Reported missing at CCW Building</p>
              </div>
            </div>
            <div className="activity-item">
              <div className="icon-wrap gold">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3>Student ID card</h3>
                <p>Recovered by the library desk</p>
              </div>
            </div>
            <div className="activity-item">
              <div className="icon-wrap green">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3>USB-C cable set</h3>
                <p>Claimed by the owner today</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { items } = useItems()

  const stats = useMemo(() => {
    const lost = items.filter((item) => item.type === 'lost').length
    const found = items.filter((item) => item.type === 'found').length
    const resolved = Math.max(1, Math.round((found / Math.max(1, lost + found)) * 100))

    return { lost, found, resolved }
  }, [items])

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Campus dashboard</h1>
        </div>
        <Link to="/report" className="primary-btn compact">
          <PlusCircle size={18} />
          Report item
        </Link>
      </section>

      <section className="stats-grid three-columns">
        <div className="stat-card accent">
          <div className="stat-icon">
            <Search size={20} />
          </div>
          <div>
            <span className="label">Lost items</span>
            <strong>{stats.lost}</strong>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">
            <Package size={20} />
          </div>
          <div>
            <span className="label">Found items</span>
            <strong>{stats.found}</strong>
          </div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="label">Recovered</span>
            <strong>{stats.resolved}%</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header spaced">
          <div>
            <p className="panel-tag">Recent reports</p>
            <h2>Latest item activity</h2>
          </div>
          <Link to="/lost" className="text-link">View all</Link>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Location</th>
                <th>Reporter</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 5).map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="item-title">{item.title}</div>
                  </td>
                  <td>
                    <span className={`pill ${item.type === 'lost' ? 'warning' : 'success'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td>{item.location}</td>
                  <td>{item.reporter}</td>
                  <td>
                    <span className="date-badge">
                      <Calendar size={14} />
                      {item.date}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function LostItemsPage() {
  const { items } = useItems()
  const lostItems = items.filter((item) => item.type === 'lost')

  return (
    <ItemListPage title="Lost items" description="Missing items reported by students and staff." items={lostItems} />
  )
}

function FoundItemsPage() {
  const { items } = useItems()
  const foundItems = items.filter((item) => item.type === 'found')

  return (
    <ItemListPage title="Found items" description="Items recovered and waiting to be claimed." items={foundItems} />
  )
}

function ItemListPage({ title, description, items }) {
  const [query, setQuery] = useState('')

  const filtered = items.filter((item) => {
    const haystack = `${item.title} ${item.location} ${item.reporter} ${item.description}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  return (
    <div className="page-shell">
      <section className="page-header stacked">
        <div>
          <p className="eyebrow">Records</p>
          <h1>{title}</h1>
        </div>
        <p className="subtle-copy">{description}</p>
      </section>

      <section className="search-panel">
        <div className="search-box">
          <Search size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by item, location, or reporter"
            aria-label="Search items"
          />
        </div>
      </section>

      <section className="item-grid">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <article key={item.id} className="item-card">
              <div className="card-top">
                <span className={`pill ${item.type === 'lost' ? 'warning' : 'success'}`}>{item.type}</span>
                <span className="date-badge muted">
                  <Calendar size={14} />
                  {item.date}
                </span>
              </div>
              <h3>{item.title}</h3>
              <p className="description">{item.description}</p>
              <div className="meta-row">
                <span>
                  <MapPin size={15} />
                  {item.location}
                </span>
                <span>
                  <Package size={15} />
                  {item.reporter}
                </span>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <AlertTriangle size={26} />
            <p>No matching items were found.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function ReportItemPage() {
  const navigate = useNavigate()
  const { addItem } = useItems()
  const [form, setForm] = useState(initialForm)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.title || !form.location || !form.reporter || !form.description) {
      return
    }

    addItem({
      title: form.title,
      type: form.type,
      location: form.location,
      reporter: form.reporter,
      description: form.description,
    })

    setForm(initialForm)
    navigate(form.type === 'lost' ? '/lost' : '/found')
  }

  return (
    <div className="page-shell narrow-page">
      <section className="page-header stacked">
        <div>
          <p className="eyebrow">Report</p>
          <h1>Report a missing or found item</h1>
        </div>
        <p className="subtle-copy">Fill in the details to help campus staff or the owner find the item faster.</p>
      </section>

      <form className="report-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Item title
            <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Red backpack" />
          </label>
          <label>
            Report type
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="lost">Lost item</option>
              <option value="found">Found item</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Location
            <input name="location" value={form.location} onChange={handleChange} placeholder="e.g. College of Education lobby" />
          </label>
          <label>
            Reporter name
            <input name="reporter" value={form.reporter} onChange={handleChange} placeholder="e.g. Juan Dela Cruz" />
          </label>
        </div>

        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Add color, brand, identifying details, and where it was last seen."
          />
        </label>

        <button type="submit" className="primary-btn submit-btn">
          Submit report
        </button>
      </form>
    </div>
  )
}

export default App

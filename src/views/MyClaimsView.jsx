import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'

const claimStatusLabel = (status) => {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Not approved'
  return 'Awaiting staff review'
}

export default function MyClaimsView() {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const refreshClaims = async () => {
      try {
        const currentClaims = await apiRequest('/api/claims')
        if (active) {
          setClaims(currentClaims)
          setError('')
        }
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    void refreshClaims()
    const intervalId = window.setInterval(refreshClaims, 30000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <main className="page-shell">
      <section className="page-header stacked">
        <div>
          <p className="eyebrow">Student requests</p>
          <h1>My claim requests</h1>
          <p className="subtle-copy">Private details are visible only to authorized staff reviewing your request.</p>
        </div>
        <Link to="/found" className="secondary-btn">Browse found items</Link>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty-inline">Loading your claim requests…</p>
      ) : claims.length ? (
        <section className="claim-list" aria-label="Your claim requests">
          {claims.map((claim) => (
            <article key={claim.id} className="claim-card">
              <div className="claim-card-heading">
                <div>
                  <p className="eyebrow">{claim.campus} campus</p>
                  <h2>{claim.title}</h2>
                </div>
                <span className={`claim-status ${claim.status}`}>
                  {claimStatusLabel(claim.status)}
                </span>
              </div>
              <p className="claim-proof">{claim.proof}</p>
              <time dateTime={claim.createdAt}>
                Submitted {new Date(claim.createdAt).toLocaleDateString()}
              </time>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No claim requests yet</h2>
          <p>When you request to claim a found item, you can follow its review here.</p>
          <Link to="/found" className="primary-btn compact">Browse found items</Link>
        </section>
      )}
    </main>
  )
}

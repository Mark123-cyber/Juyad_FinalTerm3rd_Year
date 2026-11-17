import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'

export default function ClaimRequestForm({ item, claim, onSubmitted }) {
  const [formOpen, setFormOpen] = useState(false)
  const [proof, setProof] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const newClaim = await apiRequest(`/api/items/${encodeURIComponent(item.id)}/claims`, {
        method: 'POST',
        body: JSON.stringify({ proof: proof.trim() }),
      })
      setProof('')
      setFormOpen(false)
      onSubmitted(newClaim)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (claim?.status === 'pending') {
    return (
      <p className="claim-request-status">
        Your request is awaiting staff review. <Link to="/claims">View my claims</Link>
      </p>
    )
  }

  if (claim?.status === 'approved') {
    return (
      <p className="claim-request-status">
        Your claim was approved. <Link to="/claims">View my claims</Link>
      </p>
    )
  }

  return (
    <div className="claim-request-action">
      {claim?.status === 'rejected' && (
        <p className="claim-request-status">Your previous request was not approved. You may send another with additional details.</p>
      )}
      {!formOpen ? (
        <button type="button" className="secondary-btn" onClick={() => setFormOpen(true)}>
          Request to claim
        </button>
      ) : (
        <form className="claim-request-form" onSubmit={handleSubmit}>
          <label>
            Help staff verify this item
            <textarea
              value={proof}
              onChange={(event) => setProof(event.target.value)}
              placeholder="Describe an identifying detail that is not shown in the public report."
              maxLength={2000}
              required
            />
          </label>
          <p className="field-hint">Only authorized staff can view these details.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="claim-request-actions">
            <button type="button" className="secondary-btn" onClick={() => { setFormOpen(false); setError('') }}>
              Cancel
            </button>
            <button type="submit" className="primary-btn compact" disabled={submitting || !proof.trim()}>
              {submitting ? 'Submitting…' : 'Send request'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useItems } from '../contexts/ItemContext'

const initialForm = {
  title: '',
  description: '',
  location: '',
  type: 'lost',
  reporter: '',
}

export default function ReportItemView() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addItem } = useItems()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isStaff = user?.role === 'admin'

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await addItem({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        type: form.type,
        ...(isStaff ? { reporter: form.reporter.trim() } : {}),
      })
      navigate(form.type === 'lost' ? '/lost' : '/found')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-shell narrow-page">
      <section className="page-header stacked">
        <div>
          <p className="eyebrow">{isStaff ? 'Staff report' : 'New report'}</p>
          <h1>Report an item</h1>
          <p className="subtle-copy">
            {isStaff
              ? 'Record a lost or found item reported to your office. You can leave the person’s name blank for privacy.'
              : 'Share a few details to help reconnect an item with its owner.'}
          </p>
        </div>
      </section>

      <form className="report-form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="For example, blue water bottle"
            required
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Describe the item and any identifying details"
            required
          />
        </label>

        <label>
          Location
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Where was it lost or found?"
            required
          />
        </label>

        <label>
          Type
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
        </label>

        {isStaff && (
          <label>
            Person reporting (optional)
            <input
              name="reporter"
              value={form.reporter}
              onChange={handleChange}
              placeholder="Leave blank to keep their name private"
              maxLength={120}
            />
          </label>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-btn submit-btn" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit report'}</button>
      </form>
    </main>
  )
}

import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, MapPin, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function AuthView() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('sign-in')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const isSignUp = mode === 'sign-up'

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.currentTarget)
    const emailOrStudentId = String(formData.get('emailOrStudentId') || '').trim()
    const password = String(formData.get('password') || '')
    const fullName = String(formData.get('fullName') || '').trim()
    const campus = String(formData.get('campus') || '').trim()

    if (!emailOrStudentId || !password || (isSignUp && (!fullName || !campus))) {
      setError('Please complete all required fields.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    navigate('/dashboard')
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-header">
          <div className="auth-mark" aria-hidden="true">
            <MapPin size={22} />
          </div>
          <p className="auth-university">Southern Leyte State University</p>
          <h1 id="auth-title">Campus Lost &amp; Found Portal</h1>
          <p className="auth-intro">Sign in to help reunite people with their belongings.</p>
        </header>

        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            className={!isSignUp ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setMode('sign-in')
              setError('')
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            className={isSignUp ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setMode('sign-up')
              setError('')
            }}
          >
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignUp && (
            <>
              <label className="field-label" htmlFor="full-name">Full Name</label>
              <div className="input-wrap">
                <UserRound size={18} aria-hidden="true" />
                <input id="full-name" name="fullName" type="text" autoComplete="name" placeholder="Your full name" required />
              </div>

              <label className="field-label" htmlFor="campus">Campus</label>
              <div className="input-wrap">
                <MapPin size={18} aria-hidden="true" />
                <input id="campus" name="campus" type="text" placeholder="Your campus" required />
              </div>
            </>
          )}

          <label className="field-label" htmlFor="email-or-student-id">Email or Student ID</label>
          <div className="input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input
              id="email-or-student-id"
              name="emailOrStudentId"
              type="text"
              autoComplete="username"
              placeholder="Email address or student ID"
              required
            />
          </div>

          <label className="field-label" htmlFor="password">Password</label>
          <div className="input-wrap">
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="primary-btn auth-submit">
            {isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footnote">For SLSU students, faculty, and staff</p>
      </section>
    </main>
  )
}

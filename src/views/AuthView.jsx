import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, MapPin, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'

export default function AuthView() {
  const navigate = useNavigate()
  const { signIn, signUp, error: serverError } = useAuth()
  const [mode, setMode] = useState('sign-in')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [campuses, setCampuses] = useState([])
  const [campusError, setCampusError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isSignUp = mode === 'sign-up'

  useEffect(() => {
    let active = true
    apiRequest('/api/campuses')
      .then((availableCampuses) => {
        if (active) setCampuses(availableCampuses)
      })
      .catch((loadError) => {
        if (active) setCampusError(loadError.message)
      })
    return () => { active = false }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const emailOrStudentId = String(formData.get('emailOrStudentId') || '').trim()
    const password = String(formData.get('password') || '')
    const fullName = String(formData.get('fullName') || '').trim()
    const studentId = String(formData.get('studentId') || '').trim()
    const email = String(formData.get('email') || '').trim()
    const campus = String(formData.get('campus') || '').trim()

    if (!emailOrStudentId && !isSignUp || !password || (isSignUp && (!fullName || !studentId || !campus))) {
      setError('Please complete all required fields.')
      setSubmitting(false)
      return
    }

    if (isSignUp && !/^[A-Za-z0-9][A-Za-z0-9-]{2,31}$/.test(studentId)) {
      setError('Student ID must be 3 to 32 characters and contain only letters, numbers, or hyphens.')
      setSubmitting(false)
      return
    }

    if (isSignUp && email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setError('Enter a valid email address of 120 characters or fewer.')
      setSubmitting(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setSubmitting(false)
      return
    }

    try {
      const user = isSignUp
        ? await signUp({ fullName, campus, studentId, email, password })
        : await signIn(emailOrStudentId, password)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setShowPassword(false)
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-card" aria-labelledby="auth-title">
          <header className="auth-header">
            <p className="auth-university">Southern Leyte State University</p>
            <h1 key={mode} id="auth-title" className="auth-title-enter">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
            <p className="auth-intro">Campus Lost &amp; Found Portal</p>
          </header>

          <div className={isSignUp ? 'auth-tabs is-sign-up' : 'auth-tabs'} role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={!isSignUp}
              className={!isSignUp ? 'auth-tab active' : 'auth-tab'}
              onClick={() => switchMode('sign-in')}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignUp}
              className={isSignUp ? 'auth-tab active' : 'auth-tab'}
              onClick={() => switchMode('sign-up')}
            >
              Sign Up
            </button>
          </div>

          {serverError && <p className="form-error server-error" role="alert">{serverError}</p>}
          <form className={`auth-form${isSignUp ? ' signup' : ''}`} onSubmit={handleSubmit} noValidate>
            <div className="auth-signup-fields" aria-hidden={!isSignUp}>
              <div className="auth-signup-fields-inner">
                <label className="field-label" htmlFor="full-name">Full Name</label>
                <div className="input-wrap">
                  <UserRound size={18} aria-hidden="true" />
                  <input id="full-name" name="fullName" type="text" autoComplete="name" placeholder="Your full name" required disabled={!isSignUp} />
                </div>

                <label className="field-label" htmlFor="campus">Campus</label>
                <div className="input-wrap">
                  <MapPin size={18} aria-hidden="true" />
                  <select id="campus" name="campus" defaultValue="" required disabled={!isSignUp}>
                    <option value="" disabled>{campuses.length ? 'Select your campus' : 'Loading campuses…'}</option>
                    {campuses.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
                  </select>
                </div>
                {campusError && <p className="form-error" role="alert">{campusError}</p>}

                <label className="field-label" htmlFor="student-id">Student ID</label>
                <div className="input-wrap">
                  <UserRound size={18} aria-hidden="true" />
                  <input
                    id="student-id"
                    name="studentId"
                    type="text"
                    autoComplete="off"
                    placeholder="Your student ID"
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z0-9][A-Za-z0-9-]{2,31}"
                    required
                    disabled={!isSignUp}
                  />
                </div>
                <p className="field-hint">3–32 letters, numbers, or hyphens.</p>

                <label className="field-label" htmlFor="signup-email">Email <span>(optional)</span></label>
                <div className="input-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email address"
                    maxLength={120}
                    disabled={!isSignUp}
                  />
                </div>
              </div>
            </div>

            <div className={`auth-identifier-fields${isSignUp ? ' is-hidden' : ''}`} aria-hidden={isSignUp}>
              <div className="auth-identifier-fields-inner">
                <label className="field-label" htmlFor="email-or-student-id">Email or Student ID</label>
                <div className="input-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="email-or-student-id"
                    name="emailOrStudentId"
                    type="text"
                    autoComplete="username"
                    placeholder="Email address or student ID"
                    maxLength={120}
                    required={!isSignUp}
                    disabled={isSignUp}
                  />
                </div>
              </div>
            </div>

            <label className="field-label" htmlFor="password">Password</label>
            <div className="input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={128}
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

            <button type="submit" className="primary-btn auth-submit" disabled={submitting || (isSignUp && campuses.length === 0)}>
              {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="auth-footnote">For SLSU students, faculty, and staff</p>
        </section>
      </div>
    </main>
  )
}

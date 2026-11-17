import { useState } from 'react'
import { BellRing, Eye, EyeOff, LockKeyhole, Mail, MapPin, PackageSearch, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AuthView() {
  const navigate = useNavigate()
  const { signIn, error: serverError } = useAuth()
  const [accountType, setAccountType] = useState('student')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.currentTarget)
    const emailOrStudentId = String(formData.get('emailOrStudentId') || '').trim()
    const password = String(formData.get('password') || '')
    const shouldRemember = formData.get('rememberMe') === 'on'

    if (!emailOrStudentId || !password) {
      setError('Please complete all required fields.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      const user = await signIn(emailOrStudentId, password, accountType, shouldRemember)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const switchAccountType = (nextType) => {
    setAccountType(nextType)
    setError('')
    setShowPassword(false)
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <div className="auth-story-brand">
            <span className="auth-story-mark"><PackageSearch size={23} aria-hidden="true" /></span>
            <span>
              <strong>Southern Leyte</strong>
              <small>State University</small>
            </span>
          </div>

          <div className="auth-story-content">
            <p className="auth-story-eyebrow"><span aria-hidden="true" /> SLSU CAMPUS COMMUNITY</p>
            <h2 id="auth-story-title">Lost something?<br />Found something?</h2>
            <p className="auth-story-description">
              One campus space to report items, explore finds, and reconnect belongings with their owners.
            </p>

            <div className="auth-story-features">
              <div className="auth-story-feature">
                <span className="auth-story-feature-icon"><MapPin size={18} aria-hidden="true" /></span>
                <span>
                  <strong>Campus-focused</strong>
                  <small>Reports organized by campus.</small>
                </span>
              </div>
              <div className="auth-story-feature">
                <span className="auth-story-feature-icon"><BellRing size={18} aria-hidden="true" /></span>
                <span>
                  <strong>Stay informed</strong>
                  <small>Updates on new reports and claims.</small>
                </span>
              </div>
              <div className="auth-story-feature">
                <span className="auth-story-feature-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
                <span>
                  <strong>Staff supported</strong>
                  <small>Claims reviewed by campus staff.</small>
                </span>
              </div>
            </div>
          </div>

          <p className="auth-story-footer">A helpful campus community starts with looking out for one another.</p>
        </section>

        <section className="auth-panel" aria-label="Account access">
          <div className="auth-card">
            <header className="auth-header">
              <p className="auth-university">STUDENT &amp; STAFF ACCESS</p>
              <h1 id="auth-title" className="auth-title-enter">Welcome back</h1>
              <p className="auth-intro">Sign in to continue to the campus portal.</p>
            </header>

            <fieldset className="auth-account-type">
              <legend>Choose your account type</legend>
              <div className="auth-account-options" role="radiogroup" aria-label="Account type">
                <label className={accountType === 'student' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="accountType"
                    value="student"
                    checked={accountType === 'student'}
                    onChange={() => switchAccountType('student')}
                  />
                  <span>Student</span>
                </label>
                <label className={accountType === 'staff' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="accountType"
                    value="staff"
                    checked={accountType === 'staff'}
                    onChange={() => switchAccountType('staff')}
                  />
                  <span>SSC / Admin / Registrar</span>
                </label>
              </div>
            </fieldset>

            {serverError && <p className="form-error server-error" role="alert">{serverError}</p>}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <label className="field-label" htmlFor="email-or-student-id">
                {accountType === 'student' ? 'Email or Student ID' : 'Staff username, ID, or email'}
              </label>
              <div className="input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="email-or-student-id"
                  name="emailOrStudentId"
                  type="text"
                  autoComplete="username"
                  placeholder={accountType === 'student' ? 'Email address or student ID' : 'Staff username, ID, or email'}
                  maxLength={120}
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
                  autoComplete="current-password"
                  placeholder="Enter your password"
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
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff size={18} aria-hidden="true" />
                    : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>

              <label className="remember-me">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember me on this device</span>
              </label>

              {error && <p className="form-error" role="alert">{error}</p>}

              <button type="submit" className="primary-btn auth-submit" disabled={submitting}>
                {submitting ? 'Please wait…' : 'Sign in'}
              </button>
            </form>

            <p className="auth-footnote">
              {accountType === 'student'
                ? 'Student accounts are created by campus staff. Contact your campus administrator for access.'
                : 'For authorized SSC, administrator, and registrar accounts. Contact your campus administrator if you need access.'}
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

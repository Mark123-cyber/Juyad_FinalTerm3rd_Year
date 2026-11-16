import { useEffect, useState } from 'react'
import { BellRing, Eye, EyeOff, LockKeyhole, Mail, MapPin, PackageSearch, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'

export default function AuthView() {
  const navigate = useNavigate()
  const { signIn, signUp, error: serverError } = useAuth()
  const [mode, setMode] = useState('sign-in')
  const [accountType, setAccountType] = useState('student')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
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
    const shouldRemember = formData.get('rememberMe') === 'on'
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
        : await signIn(emailOrStudentId, password, accountType, shouldRemember)
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

  const switchAccountType = (nextType) => {
    setAccountType(nextType)
    if (nextType === 'staff') setMode('sign-in')
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
              <h1 key={`${mode}-${accountType}`} id="auth-title" className="auth-title-enter">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
              <p className="auth-intro">{isSignUp ? 'Join your campus lost and found community.' : 'Sign in to continue to the campus portal.'}</p>
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

            <div className={`auth-tabs${isSignUp ? ' is-sign-up' : ''}${accountType === 'staff' ? ' is-staff' : ''}`} role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignUp}
                className={!isSignUp ? 'auth-tab active' : 'auth-tab'}
                onClick={() => switchMode('sign-in')}
              >
                Sign In
              </button>
              {accountType === 'student' && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSignUp}
                  className={isSignUp ? 'auth-tab active' : 'auth-tab'}
                  onClick={() => switchMode('sign-up')}
                >
                  Sign Up
                </button>
              )}
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
                      pattern="[A-Za-z0-9](?:[A-Za-z0-9]|-){2,31}"
                      required
                      disabled={!isSignUp}
                    />
                  </div>
                  <p className="field-hint">3–32 letters, numbers, or hyphens.</p>

                  <label className="field-label" htmlFor="signup-email">Email <span>(optional, used for email alerts)</span></label>
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
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff size={18} aria-hidden="true" />
                    : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>

              {!isSignUp && (
                <label className="remember-me">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Remember me on this device</span>
                </label>
              )}

              {error && <p className="form-error" role="alert">{error}</p>}

              <button type="submit" className="primary-btn auth-submit" disabled={submitting || (isSignUp && campuses.length === 0)}>
                {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <p className="auth-footnote">
              {accountType === 'student'
                ? 'For SLSU students. Student accounts can be created here.'
                : 'For authorized SSC, administrator, and registrar accounts. Contact your campus administrator if you need access.'}
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

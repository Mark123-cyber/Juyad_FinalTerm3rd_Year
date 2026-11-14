// oxlint-disable react/only-export-components -- Keep the auth hook beside its provider.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/api/auth/me')
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser)
      })
      .catch((error) => {
        console.error('Could not restore the signed-in user.', error)
        if (active) {
          setUser(null)
          setError(error.message)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const signIn = async (emailOrStudentId, password) => {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrStudentId, password }),
    })
    setError('')
    setUser(result.user)
    return result.user
  }

  const signUp = async (account) => {
    const result = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(account),
    })
    setError('')
    setUser(result.user)
    return result.user
  }

  const signOut = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' })
    setError('')
    setUser(null)
  }

  const value = useMemo(() => ({
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
  }), [user, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

// oxlint-disable react/only-export-components -- Keep the item hook beside its provider.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { apiRequest } from '../lib/api'

const ItemContext = createContext(null)
const EMPTY_ITEMS = []

export function ItemProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const [snapshot, setSnapshot] = useState({
    userId: null,
    items: [],
    loading: true,
    error: '',
  })

  useEffect(() => {
    let active = true
    if (!userId) return undefined
    apiRequest('/api/items')
      .then((currentItems) => {
        if (active) setSnapshot({ userId, items: currentItems, loading: false, error: '' })
      })
      .catch((error) => {
        console.error('Could not load item reports.', error)
        if (active) setSnapshot({ userId, items: [], loading: false, error: error.message })
      })

    return () => { active = false }
  }, [userId])

  const isCurrentUserData = Boolean(userId && snapshot.userId === userId)
  const items = isCurrentUserData ? snapshot.items : EMPTY_ITEMS
  const loading = Boolean(userId) && (!isCurrentUserData || snapshot.loading)
  const error = isCurrentUserData ? snapshot.error : ''

  const addItem = useCallback(async (item) => {
    const savedItem = await apiRequest('/api/items', {
      method: 'POST',
      body: JSON.stringify(item),
    })
    setSnapshot((previous) => ({
      ...previous,
      userId,
      items: [savedItem, ...previous.items],
    }))
  }, [userId])

  const updateItem = useCallback(async (id, changes) => {
    const updatedItem = await apiRequest(`/api/admin/items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
    setSnapshot((previous) => ({
      ...previous,
      userId,
      items: previous.items.map((item) => item.id === id ? updatedItem : item),
    }))
  }, [userId])

  const deleteItem = useCallback(async (id) => {
    await apiRequest(`/api/admin/items/${encodeURIComponent(id)}`, { method: 'DELETE' })
    setSnapshot((previous) => ({
      ...previous,
      userId,
      items: previous.items.filter((item) => item.id !== id),
    }))
  }, [userId])

  const value = useMemo(() => ({
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
  }), [items, loading, error, addItem, updateItem, deleteItem])

  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>
}

export function useItems() {
  const ctx = useContext(ItemContext)
  if (!ctx) {
    throw new Error('useItems must be used within an ItemProvider')
  }
  return ctx
}
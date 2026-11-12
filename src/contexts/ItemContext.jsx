import { createContext, useContext, useMemo, useState } from 'react'

const ItemContext = createContext(null)

// A few seed items so the lists aren't empty on first load.
const SEED_ITEMS = [
  {
    id: 'seed-1',
    title: 'Black Samsung Galaxy S21',
    description: 'Left in the CCW Building lobby after a lab session. Dark case, small crack on screen.',
    location: 'CCW Building, 2nd Floor Lobby',
    type: 'lost',
    reporter: 'Juan Dela Cruz',
    date: '2026-11-10',
  },
  {
    id: 'seed-2',
    title: 'Set of USB-C Cables',
    description: 'Two braided USB-C charging cables found near the library entrance.',
    location: 'SLSU Library, Main Entrance',
    type: 'found',
    reporter: 'Maria Santos',
    date: '2026-11-11',
  },
]

export function ItemProvider({ children }) {
  const [items, setItems] = useState(SEED_ITEMS)

  const addItem = (item) => {
    setItems((prev) => [
      {
        ...item,
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: new Date().toLocaleDateString('en-CA'),
      },
      ...prev,
    ])
  }

  const value = useMemo(() => ({ items, addItem }), [items])

  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>
}

export function useItems() {
  const ctx = useContext(ItemContext)
  if (!ctx) {
    throw new Error('useItems must be used within an ItemProvider')
  }
  return ctx
}
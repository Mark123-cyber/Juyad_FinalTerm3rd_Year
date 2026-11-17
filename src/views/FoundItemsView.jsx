import { useEffect, useState } from 'react'
import ClaimRequestForm from '../components/ClaimRequestForm'
import ItemListView from '../components/ItemListView'
import { useAuth } from '../contexts/AuthContext'
import { useItems } from '../contexts/ItemContext'
import { apiRequest } from '../lib/api'

export default function FoundItemsView() {
  const { items, loading, error } = useItems()
  const { user } = useAuth()
  const [claims, setClaims] = useState([])
  const [claimsError, setClaimsError] = useState('')

  useEffect(() => {
    if (user?.role !== 'user') return undefined

    let active = true
    apiRequest('/api/claims')
      .then((currentClaims) => {
        if (active) {
          setClaims(currentClaims)
          setClaimsError('')
        }
      })
      .catch((loadError) => {
        if (active) setClaimsError(loadError.message)
      })
    return () => { active = false }
  }, [user?.id, user?.role])

  const claimsByItem = new Map()
  for (const claim of claims) {
    if (!claimsByItem.has(claim.itemId)) claimsByItem.set(claim.itemId, claim)
  }

  const handleClaimSubmitted = (newClaim) => {
    setClaims((currentClaims) => [newClaim, ...currentClaims])
  }

  return (
    <ItemListView
      title="Found items"
      description="Browse staff-verified found items. Submit a private claim request if you believe an item is yours."
      items={items.filter((item) => item.type === 'found')}
      loading={loading}
      error={error}
      extraError={claimsError}
      renderItemAction={user?.role === 'user'
        ? (item) => item.canClaim
          ? (
            <ClaimRequestForm
              item={item}
              claim={claimsByItem.get(item.id)}
              onSubmitted={handleClaimSubmitted}
            />
          )
          : null
        : undefined}
    />
  )
}

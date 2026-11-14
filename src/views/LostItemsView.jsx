import ItemListView from '../components/ItemListView'
import { useItems } from '../contexts/ItemContext'

export default function LostItemsView() {
  const { items, loading, error } = useItems()

  return (
    <ItemListView
      title="Lost items"
      description="Items reported missing around the SLSU campuses."
      items={items.filter((item) => item.type === 'lost')}
      loading={loading}
      error={error}
    />
  )
}

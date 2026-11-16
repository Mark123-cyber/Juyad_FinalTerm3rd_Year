import ItemListView from '../components/ItemListView'
import { useItems } from '../contexts/ItemContext'

export default function FoundItemsView() {
  const { items, loading, error } = useItems()

  return (
    <ItemListView
      title="Found items"
      description="Items reported found across SLSU campuses. Check the follow-up status before contacting campus staff."
      items={items.filter((item) => item.type === 'found')}
      loading={loading}
      error={error}
    />
  )
}

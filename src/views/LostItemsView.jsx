import ItemListView from '../components/ItemListView'
import { useItems } from '../contexts/ItemContext'

export default function LostItemsView() {
  const { items } = useItems()

  return (
    <ItemListView
      title="Lost items"
      description="Items reported missing around the SLSU campuses."
      items={items.filter((item) => item.type === 'lost')}
    />
  )
}
